import { Button, Text } from '@mantine/core'
import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { SUPPORTED_LANGUAGES } from '@locale/shared'

import ButtonLink from '@/atoms/ButtonLink/ButtonLink'
import ActivityAvatar from '@/components/ActivityAvatar/ActivityAvatar'
import AppModal from '@/components/AppModal/AppModal'
import { ArrowRight } from '@/components/Icons'
import LanguageFlag from '@/components/LanguageFlag/LanguageFlag'
import TranslationDiff from '@/components/TranslationDiff/TranslationDiff'
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
		const block = (title: string, value: string | null, emptyLabel: string, side: 'before' | 'after') => (
			<section className={classes.block} data-side={side}>
				<h3 className={classes.blockTitle}>{title}</h3>
				{value === null ? (
					<Text size='sm' className={classes.empty}>
						{emptyLabel}
					</Text>
				) : (
					<p className={classes.value}>
						<TranslationDiff oldValue={oldValue ?? ''} newValue={newValue ?? ''} languageTag={languageTag} side={side} />
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
