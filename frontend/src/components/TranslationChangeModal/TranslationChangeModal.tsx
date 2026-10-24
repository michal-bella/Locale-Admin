import { Button, Text } from '@mantine/core'
import { diffArrays } from 'diff'
import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { SUPPORTED_LANGUAGES } from '@locale/shared'

import ButtonLink from '@/atoms/ButtonLink/ButtonLink'
import ActivityAvatar from '@/components/ActivityAvatar/ActivityAvatar'
import AppModal from '@/components/AppModal/AppModal'
import { ArrowRight } from '@/components/Icons'
import LanguageFlag from '@/components/LanguageFlag/LanguageFlag'
import { type Token, tokenize } from '@/components/TokenEditor/tokens'
import TranslationText from '@/components/TranslationText/TranslationText'
import { formatDateTime } from '@/lib/formatDate'
import { formatRelativeTime } from '@/lib/formatRelativeTime'
import { translationEditSearch } from '@/lib/translationEditSearch'

import classes from './TranslationChangeModal.module.css'
import { type TranslationChangeModalProps } from './types'

/**
 * Read-only detail of a translation edit from História: who, when, the key and language, and the old value against the new one
 * highlighted word by word, removed words in Pred and added ones in Po. Variables and HTML tags are chips as in Upraviť preklad. Otvoriť preklad opens the key in Preklady with Upraviť preklad,
 * like the → of the row.
 */
const TranslationChangeModal = ({ opened, event, projectSlug, onClose }: TranslationChangeModalProps) => {
	const { t, i18n } = useTranslation()
	const search = event ? translationEditSearch(event) : undefined

	const renderBody = (): ReactNode => {
		if (!event) {
			return null
		}
		const { languageTag, oldValue, newValue } = event.payload
		const language = SUPPORTED_LANGUAGES.find((supported) => supported.tag === languageTag)
		const languageName = language ? t(`languageNames.${language.tag}`) : languageTag
		// Not diffWordsWithSpace: its tokenizer knows only Latin letters (it ignores `intlSegmenter`) and would diff Cyrillic letter by letter.
		// The segmenter keeps spaces and newlines as their own tokens, as diffWordsWithSpace does. Variables and tags stay whole, so a
		// change never splits a chip and each part can be rendered by TranslationText again.
		const segmenter = new Intl.Segmenter(languageTag, { granularity: 'word' })
		const words = (value: string | null): Token[] =>
			tokenize(value ?? '').flatMap((token) =>
				token.type === 'text' ? Array.from(segmenter.segment(token.value), ({ segment }) => ({ type: token.type, value: segment })) : [token],
			)
		const changes = diffArrays(words(oldValue), words(newValue), { comparator: (left, right) => left.type === right.type && left.value === right.value })

		const block = (title: string, value: string | null, emptyLabel: string, side: 'before' | 'after') => (
			<section className={classes.block} data-side={side}>
				<h3 className={classes.blockTitle}>{title}</h3>
				{value === null ? (
					<Text size='sm' className={classes.empty}>
						{emptyLabel}
					</Text>
				) : (
					<p className={classes.value}>
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
					</p>
				)}
			</section>
		)

		return (
			<div className='flex flex-col gap-5'>
				<dl className={classes.meta}>
					<dt>{t('historyPage.change.language')}</dt>
					<dd className='flex items-center gap-2'>
						{language && <LanguageFlag code={language.flagCode} size='xs' />}
						{languageName.charAt(0).toLocaleUpperCase(i18n.language) + languageName.slice(1)}
					</dd>
					{event.version && (
						<>
							<dt>{t('historyPage.change.version')}</dt>
							<dd>{event.version.name}</dd>
						</>
					)}
					<dt>{t('historyPage.change.user')}</dt>
					<dd className='flex items-center gap-2'>
						<ActivityAvatar event={event} />
						{event.user?.name ?? t('dashboardPage.activity.deletedUser')}
					</dd>
					<dt>{t('historyPage.change.time')}</dt>
					<dd>
						<time dateTime={event.createdAt}>{formatDateTime(event.createdAt, i18n.language)}</time>
						<span className={classes.relative}> · {formatRelativeTime(event.createdAt, i18n.language)}</span>
					</dd>
				</dl>
				<div className={classes.blocks}>
					{block(t('historyPage.change.before'), oldValue, t('historyPage.change.untranslated'), 'before')}
					<ArrowRight aria-hidden className={classes.arrow} />
					{block(t('historyPage.change.after'), newValue, t('historyPage.change.cleared'), 'after')}
				</div>
			</div>
		)
	}

	return (
		<AppModal
			opened={opened}
			onClose={onClose}
			title={t('historyPage.change.title')}
			description={
				event && (
					<code className={classes.key}>
						{event.payload.namespace && `${event.payload.namespace}:`}
						<TranslationText value={event.payload.name} chipTooltips={false} />
					</code>
				)
			}
			closeLabel={t('historyPage.change.close')}
			size={880}
			footer={
				<>
					<Button variant='default' onClick={onClose}>
						{t('historyPage.change.close')}
					</Button>
					{search && (
						<ButtonLink to='/projects/$projectSlug/translations' params={{ projectSlug }} search={search} rightSection={<ArrowRight aria-hidden />}>
							{t('historyPage.change.open')}
						</ButtonLink>
					)}
				</>
			}
		>
			{renderBody()}
		</AppModal>
	)
}

export default TranslationChangeModal
