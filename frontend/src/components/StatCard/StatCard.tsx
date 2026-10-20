import { Button, Progress, Skeleton, Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'

import ButtonLink from '@/atoms/ButtonLink/ButtonLink'
import { ArrowRight } from '@/components/Icons'

import classes from './StatCard.module.css'
import { type StatCardProps } from './types'

/* Same hues as the status badges: Preložené teal, Nepreložené red. */
const TONE_COLOR = { brand: 'brand', success: 'teal', danger: 'red' } as const

/** Label, value and icon tile of Figma 3:62 (Preklady) and 3:532 (Prehľad), optionally with a hint, a progress bar and a filter button or link. */
const StatCard = ({ label, value, hint, icon: Icon, tone, percent, filter, link }: StatCardProps) => {
	const { t } = useTranslation()

	return (
		<div className={classes.card}>
			<div className='flex items-start justify-between gap-3'>
				<div className='flex flex-col gap-1'>
					<Text fz='xs' fw={500} lh='xs'>
						{label}
					</Text>
					{value === undefined ? <Skeleton height={32} width={64} radius='sm' /> : <span className={classes.value}>{value}</span>}
					{hint !== undefined && value !== undefined && <span className={classes.hint}>{hint}</span>}
					{filter && (
						<Button
							size='compact-xs'
							variant='subtle'
							color={TONE_COLOR[tone]}
							rightSection={<ArrowRight aria-hidden />}
							aria-pressed={filter.active}
							className={classes.filterButton}
							onClick={filter.onClick}
						>
							{filter.label}
						</Button>
					)}
					{link && (
						<ButtonLink
							to={link.to}
							params={link.params}
							search={link.search}
							size='compact-xs'
							variant='subtle'
							color={TONE_COLOR[tone]}
							rightSection={<ArrowRight aria-hidden />}
							className={classes.filterButton}
						>
							{link.label}
						</ButtonLink>
					)}
				</div>
				<span aria-hidden data-tone={tone} className={classes.iconTile}>
					<Icon />
				</span>
			</div>
			{percent !== undefined && (
				<Progress.Root size={4} radius='xl' mt='md' classNames={{ root: classes.track }}>
					<Progress.Section value={percent} color={TONE_COLOR[tone]} aria-label={t('translationsPage.stats.progressLabel', { label, percent })} />
				</Progress.Root>
			)}
		</div>
	)
}

export default StatCard
