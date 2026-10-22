import { useTranslation } from 'react-i18next'

import { type TranslationStatus } from '@locale/shared'

import { Check, File, Key } from '@/components/Icons'
import LanguageFlag from '@/components/LanguageFlag/LanguageFlag'
import StatCard from '@/components/StatCard/StatCard'
import { formatShare } from '@/lib/formatShare'

import classes from './TranslationStats.module.css'
import { type TranslationStatsProps } from './types'

const toPercent = (part: number, total: number) => (total === 0 ? 0 : Math.round((part / total) * 100))

/** Celkom kľúčov, Preložené and Nepreložené of Figma 3:62 for the target language. The Na kontrolu card is left out, that status does not exist. */
const TranslationStats = ({ stats, language, status, onStatusChange }: TranslationStatsProps) => {
	const { t, i18n } = useTranslation()

	const share = (part: number, total: number) => {
		const { percent, bound } = formatShare(part, total, i18n.language)
		return t('translationsPage.stats.share', { percent: bound ? t(`dashboardPage.${bound}`, { percent }) : percent })
	}

	const languageTag = language && (
		<span className={classes.language}>
			<LanguageFlag code={language.flagCode} size='xs' />
			{t(`languageNames.${language.tag}`)}
		</span>
	)

	// Empty cells of the target language in the compact view, of every language in the extended one.
	const missingTranslations =
		stats &&
		(language ? (stats.untranslatedByLanguage[language.id] ?? 0) : Object.values(stats.untranslatedByLanguage).reduce((sum, count) => sum + count, 0))

	const filterFor = (value: TranslationStatus | undefined, label: string) => ({ label, active: status === value, onClick: () => onStatusChange(value) })

	return (
		<div aria-busy={stats === undefined} className='grid grid-cols-1 gap-3 md:grid-cols-3'>
			<StatCard
				label={t('translationsPage.stats.totalKeys')}
				value={stats?.totalKeys}
				icon={Key}
				tone='brand'
				filter={filterFor(undefined, t('translationsPage.stats.showAll'))}
			/>
			<StatCard
				label={t('translationsPage.stats.translated')}
				value={stats?.translated}
				icon={Check}
				tone='success'
				labelSuffix={languageTag}
				percent={stats && toPercent(stats.translated, stats.totalKeys)}
				share={stats && share(stats.translated, stats.totalKeys)}
				filter={filterFor('TRANSLATED', t('translationsPage.stats.showTranslated'))}
			/>
			<StatCard
				label={t('translationsPage.stats.missing')}
				value={stats?.untranslated}
				icon={File}
				tone='danger'
				labelSuffix={languageTag}
				percent={stats && toPercent(stats.untranslated, stats.totalKeys)}
				share={
					stats &&
					[
						share(stats.untranslated, stats.totalKeys),
						missingTranslations ? t('translationsPage.stats.missingTranslations', { count: missingTranslations }) : '',
					]
						.filter(Boolean)
						.join(' · ')
				}
				filter={filterFor('UNTRANSLATED', t('translationsPage.stats.showMissing'))}
			/>
		</div>
	)
}

export default TranslationStats
