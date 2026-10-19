import { tokenize } from '@/components/TokenEditor/tokens'

import classes from './TranslationText.module.css'
import { type TranslationTextProps } from './types'

/**
 * A translation value with `{{var}}` (also `{{ var }}`) as chips (Figma 3:177), and `#` too for a plural form. Everything else, HTML
 * included, is plain text: React escapes it, so `<strong>` shows up as typed and never renders.
 */
const TranslationText = ({ value, pluralHash = false }: TranslationTextProps) => (
	<span className={classes.text}>
		{tokenize(value, { tags: false, hash: pluralHash }).map((token, index) =>
			token.type === 'text' ? (
				token.value
			) : (
				<code key={index} className={classes.chip}>
					{token.value}
				</code>
			),
		)}
	</span>
)

export default TranslationText
