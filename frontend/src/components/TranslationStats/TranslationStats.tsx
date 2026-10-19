import { Button, Progress, Skeleton, Text } from '@mantine/core'
import { type ComponentType, type SVGProps } from 'react'
import { useTranslation } from 'react-i18next'

import { type TranslationStatus } from '@locale/shared'

import { ArrowRight, Check, File, Key } from '@/components/Icons'

import classes from './TranslationStats.module.css'
import { type TranslationStatsProps } from './types'

type StatCardProps = {
	label: string
	value?: number
	icon: ComponentType<SVGProps<SVGSVGElement>>
	tone: 'brand' | 'warning'
	/** Share of all keys in percent; the card without it has no progress bar. */
	percent?: number
	/** Sets the table's status filter to this card's keys; `active` while that filter is on. */
	filter?: { label: string; active: boolean; onClick: () => void }
}

const StatCard = ({ label, value, icon: Icon, tone, percent, filter }: StatCardProps) => {
	const { t } = useTranslation()

	return (
		<div className={classes.card}>
			<div className='flex items-start justify-between gap-3'>
				<div className='flex flex-col gap-1'>
					<Text fz='xs' fw={500} lh='xs'>
						{label}
					</Text>
					{value === undefined ? <Skeleton height={32} width={64} radius='sm' /> : <span className={classes.value}>{value}</span>}
					{filter && (
						<Button
							size='compact-xs'
							variant='subtle'
							rightSection={<ArrowRight aria-hidden />}
							aria-pressed={filter.active}
							className={classes.filterButton}
							onClick={filter.onClick}
						>
							{filter.label}
						</Button>
					)}
				</div>
				<span aria-hidden data-tone={tone} className={classes.iconTile}>
					<Icon />
				</span>
			</div>
			{percent !== undefined && (
				<Progress.Root size={4} radius='xl' mt='md' classNames={{ root: classes.track }}>
					<Progress.Section
						value={percent}
						color={tone === 'brand' ? 'brand' : 'yellow'}
						aria-label={t('translationsPage.stats.progressLabel', { label, percent })}
					/>
				</Progress.Root>
			)}
		</div>
	)
}

const toPercent = (part: number, total: number) => (total === 0 ? 0 : Math.round((part / total) * 100))

/** Celkom kľúčov, Preložené and Chýbajúce of Figma 3:62 for the target language. The Na kontrolu card is left out, that status does not exist. */
const TranslationStats = ({ stats, status, onStatusChange }: TranslationStatsProps) => {
	const { t } = useTranslation()

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
				tone='brand'
				percent={stats && toPercent(stats.translated, stats.totalKeys)}
				filter={filterFor('TRANSLATED', t('translationsPage.stats.showTranslated'))}
			/>
			<StatCard
				label={t('translationsPage.stats.missing')}
				value={stats?.untranslated}
				icon={File}
				tone='warning'
				percent={stats && toPercent(stats.untranslated, stats.totalKeys)}
				filter={filterFor('UNTRANSLATED', t('translationsPage.stats.showMissing'))}
			/>
		</div>
	)
}

export default TranslationStats
