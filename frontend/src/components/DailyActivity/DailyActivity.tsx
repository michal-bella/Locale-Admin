import { BarChart } from '@mantine/charts'
import { Avatar, Button, SegmentedControl, Skeleton, Text, VisuallyHidden } from '@mantine/core'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ACTIVITY_RANGE_DAYS, ACTIVITY_RANGES, type ActivityRange } from '@locale/shared'

import { useActivityDailyQuery } from '@/api/activity/activityQuery'
import getApiErrorCode from '@/api/getApiErrorCode'
import SectionCard from '@/components/SectionCard/SectionCard'
import { toIntlLocale } from '@/lib/formatDate'
import { getNameInitials } from '@/lib/utils'

import classes from './DailyActivity.module.css'
import { type DailyActivityProps } from './types'

const CHART_HEIGHT = 200

type ChartRow = { date: string; changes: number }

/**
 * Denná aktivita (not in Figma): changed translations per calendar day of the browser's time zone as bars, 7 / 30 / 90 days, and the most
 * active members of the period. The chart is hidden from screen readers; they get the summary and a visually hidden table of the days.
 */
const DailyActivity = ({ projectId, versionId }: DailyActivityProps) => {
	const { t, i18n } = useTranslation()
	const [range, setRange] = useState<ActivityRange>('30d')
	const [timeZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone)
	const { data, isPending, isError, error, refetch, isRefetching } = useActivityDailyQuery(projectId, { versionId, range, timeZone })
	const locale = toIntlLocale(i18n.language)

	// `date` is a calendar day (`YYYY-MM-DD`), which `Date` reads as UTC midnight, so it is formatted in UTC to keep the day.
	const formatDay = (date: string, withYear: boolean) =>
		new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'numeric', year: withYear ? 'numeric' : undefined, timeZone: 'UTC' }).format(new Date(date))
	const changesText = (count: number) => t('dashboardPage.daily.changes', { count })

	const renderTooltip = ({ payload }: { payload?: readonly { payload?: ChartRow }[] }) => {
		const row = payload?.[0]?.payload
		return row ? (
			<div className={classes.tooltip}>{t('dashboardPage.daily.tooltip', { date: formatDay(row.date, true), changes: changesText(row.changes) })}</div>
		) : null
	}

	const renderBody = (): ReactNode => {
		if (isPending) {
			return <Skeleton height={CHART_HEIGHT} radius='md' />
		}
		if (isError) {
			return (
				<div className={`${classes.state} flex flex-col items-center gap-1`}>
					<Text size='sm' fw={600} c='var(--app-color-text-strong)'>
						{t('dashboardPage.daily.loadError')}
					</Text>
					<Text size='xs'>{t(`errors.${getApiErrorCode(error)}`)}</Text>
					<Button variant='default' mt='md' loading={isRefetching} onClick={() => void refetch()}>
						{t('dashboardPage.daily.retry')}
					</Button>
				</div>
			)
		}
		const total = data.days.reduce((sum, day) => sum + day.changes, 0)
		return (
			<div className='flex flex-col gap-5'>
				<span className={classes.summary}>{t('dashboardPage.daily.summary', { days: ACTIVITY_RANGE_DAYS[range], changes: changesText(total) })}</span>
				<div aria-hidden>
					<BarChart
						h={CHART_HEIGHT}
						data={data.days}
						dataKey='date'
						series={[{ name: 'changes', color: 'brand.6' }]}
						accessibilityLayer={false}
						gridAxis='y'
						tickLine='none'
						maxBarWidth={24}
						xAxisProps={{ tickFormatter: (date: string) => formatDay(date, false), minTickGap: 12 }}
						yAxisProps={{ allowDecimals: false, width: 32 }}
						tooltipProps={{ content: renderTooltip }}
						tooltipAnimationDuration={0}
					/>
				</div>
				<VisuallyHidden>
					<table>
						<caption>{t('dashboardPage.daily.title')}</caption>
						<thead>
							<tr>
								<th scope='col'>{t('dashboardPage.daily.day')}</th>
								<th scope='col'>{t('dashboardPage.daily.changesColumn')}</th>
							</tr>
						</thead>
						<tbody>
							{data.days.map((day) => (
								<tr key={day.date}>
									<th scope='row'>{formatDay(day.date, true)}</th>
									<td>{day.changes}</td>
								</tr>
							))}
						</tbody>
					</table>
				</VisuallyHidden>
				<div className='flex flex-col gap-3'>
					<h3 className={classes.subtitle}>{t('dashboardPage.daily.contributors')}</h3>
					{data.contributors.length === 0 ? (
						<Text size='xs'>{t('dashboardPage.daily.noContributors')}</Text>
					) : (
						<ul aria-label={t('dashboardPage.daily.contributors')} className={classes.list}>
							{data.contributors.map(({ user, changes }) => (
								<li key={user.id} className='flex items-center gap-3'>
									<Avatar
										aria-hidden
										size={28}
										radius='xl'
										color='var(--app-color-avatar-muted)'
										variant='filled'
										classNames={{ placeholder: classes.initials }}
									>
										{getNameInitials(user.name)}
									</Avatar>
									<span className={classes.name}>{user.name}</span>
									<span className={classes.changes}>{changesText(changes)}</span>
								</li>
							))}
						</ul>
					)}
				</div>
			</div>
		)
	}

	return (
		<SectionCard
			title={t('dashboardPage.daily.title')}
			description={t('dashboardPage.daily.description')}
			action={
				<SegmentedControl
					size='xs'
					radius='md'
					aria-label={t('dashboardPage.daily.rangeLabel')}
					value={range}
					onChange={(value) => setRange(ACTIVITY_RANGES.find((option) => option === value) ?? '30d')}
					data={ACTIVITY_RANGES.map((option) => ({ value: option, label: t(`dashboardPage.daily.range.${option}`) }))}
				/>
			}
		>
			<div aria-busy={isPending}>{renderBody()}</div>
		</SectionCard>
	)
}

export default DailyActivity
