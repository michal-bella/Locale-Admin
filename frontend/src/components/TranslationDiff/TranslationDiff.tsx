import { diffArrays } from 'diff'

import { type Token, tokenize } from '@/components/TokenEditor/tokens'
import TranslationText from '@/components/TranslationText/TranslationText'

import classes from './TranslationDiff.module.css'
import { type TranslationDiffProps } from './types'

/**
 * One side of a word diff of two translation values: the old value with removed words struck through in red, or the new one with added
 * words in green. Variables and HTML tags are chips as in Upraviť preklad and are compared whole.
 */
const TranslationDiff = ({ oldValue, newValue, languageTag, side }: TranslationDiffProps) => {
	// Not diffWordsWithSpace: its tokenizer knows only Latin letters (it ignores `intlSegmenter`) and would diff Cyrillic letter by letter.
	// The segmenter keeps spaces and newlines as their own tokens, as diffWordsWithSpace does. Variables and tags stay whole, so a
	// change never splits a chip and each part can be rendered by TranslationText again.
	const segmenter = new Intl.Segmenter(languageTag, { granularity: 'word' })
	const words = (value: string): Token[] =>
		tokenize(value).flatMap((token) =>
			token.type === 'text' ? Array.from(segmenter.segment(token.value), ({ segment }) => ({ type: token.type, value: segment })) : [token],
		)
	const changes = diffArrays(words(oldValue), words(newValue), { comparator: (left, right) => left.type === right.type && left.value === right.value })

	return (
		<span className={classes.diff}>
			{changes.map((change, index) => {
				if (side === 'before' ? change.added : change.removed) {
					return null
				}
				const value = change.value.map((token) => token.value).join('')
				if (!change.added && !change.removed) {
					return <TranslationText key={index} value={value} chipTooltips={false} />
				}
				// The spaces around a changed word stay outside the mark, so it hugs the word or chip.
				const [, before = '', marked = '', after = ''] = /^(\s*)([\s\S]*?)(\s*)$/.exec(value) ?? []
				const Mark = change.added ? 'ins' : 'del'
				return (
					<span key={index}>
						{before}
						{marked && (
							<Mark>
								<TranslationText value={marked} chipTooltips={false} />
							</Mark>
						)}
						{after}
					</span>
				)
			})}
		</span>
	)
}

export default TranslationDiff
