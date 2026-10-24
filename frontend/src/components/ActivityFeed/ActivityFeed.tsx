import { Button, Skeleton, Text } from '@mantine/core'
import { Link } from '@tanstack/react-router'
import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { type ActivityEvent } from '@locale/shared'

import { useActivityListQuery } from '@/api/activity/activityQuery'
import getApiErrorCode from '@/api/getApiErrorCode'
import ActivityAvatar from '@/components/ActivityAvatar/ActivityAvatar'
import ActivityEventLink from '@/components/ActivityEventLink/ActivityEventLink'
import SectionCard from '@/components/SectionCard/SectionCard'
import { useDescribeActivity } from '@/hooks/useDescribeActivity'
import { formatDate, formatDateTime } from '@/lib/formatDate'
import { formatRelativeTime } from '@/lib/formatRelativeTime'

import classes from './ActivityFeed.module.css'
import { type ActivityFeedProps } from './types'

const SKELETON_ROWS = 4

const ACTIVITY_FEED_SIZE = 10

const localDayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`

/**
 * Posledná aktivita of Figma 3:660: the project's last `ACTIVITY_FEED_SIZE` events grouped by day, newest first. Older events are on
 * História, linked from the card's header, so the card keeps its height.
 */
const ActivityFeed = ({ projectId, projectSlug }: ActivityFeedProps) => {
	const { t, i18n } = useTranslation()
	const { data, isPending, isError, error, refetch, isRefetching } = useActivityListQuery(projectId, { pageSize: ACTIVITY_FEED_SIZE })
	const describe = useDescribeActivity()
	const now = new Date()

	const dayLabel = (createdAt: string) => {
		const key = localDayKey(new Date(createdAt))
		if (key === localDayKey(now)) {
			return t('dashboardPage.activity.today')
		}
		if (key === localDayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))) {
			return t('dashboardPage.activity.yesterday')
		}
		return formatDate(createdAt, i18n.language)
	}

	const renderEvent = (event: ActivityEvent) => {
		const name = event.user?.name ?? t('dashboardPage.activity.deletedUser')
		return (
			<li key={event.id} className={classes.row}>
				<ActivityAvatar event={event} />
				<div className='flex min-w-0 flex-1 flex-col'>
					<span className={classes.sentence}>
						<span className={classes.name}>{name}</span> · {describe(event)}
					</span>
					<span className={classes.time}>
						<time dateTime={event.createdAt} title={formatDateTime(event.createdAt, i18n.language)}>
							{formatRelativeTime(event.createdAt, i18n.language, now, 'short')}
						</time>
						{event.version && <> · {event.version.name}</>}
					</span>
				</div>
				<ActivityEventLink event={event} projectSlug={projectSlug} now={now} />
			</li>
		)
	}

	const renderBody = (): ReactNode => {
		if (isPending) {
			return Array.from({ length: SKELETON_ROWS }, (_, index) => (
				<div key={index} className='flex items-center gap-3 py-2'>
					<Skeleton circle height={32} />
					<Skeleton height={12} width='60%' radius='sm' />
				</div>
			))
		}
		if (isError) {
			return (
				<div className={`${classes.state} flex flex-col items-center gap-1`}>
					<Text size='sm' fw={600} c='var(--app-color-text-strong)'>
						{t('dashboardPage.activity.loadError')}
					</Text>
					<Text size='xs'>{t(`errors.${getApiErrorCode(error)}`)}</Text>
					<Button variant='default' mt='md' loading={isRefetching} onClick={() => void refetch()}>
						{t('dashboardPage.activity.retry')}
					</Button>
				</div>
			)
		}
		const events = data.items
		if (events.length === 0) {
			return (
				<Text size='sm' className={classes.state}>
					{t('dashboardPage.activity.empty')}
				</Text>
			)
		}
		const days = new Map<string, ActivityEvent[]>()
		for (const event of events) {
			const label = dayLabel(event.createdAt)
			days.set(label, [...(days.get(label) ?? []), event])
		}
		return (
			<div className='flex flex-col gap-4'>
				{[...days].map(([label, dayEvents]) => (
					<div key={label}>
						<h3 className={classes.day}>{label}</h3>
						<ul aria-label={label} className={classes.list}>
							{dayEvents.map(renderEvent)}
						</ul>
					</div>
				))}
			</div>
		)
	}

	return (
		<SectionCard
			title={t('dashboardPage.activity.title')}
			description={t('dashboardPage.activity.description')}
			action={
				<Link to='/projects/$projectSlug/history' params={{ projectSlug }} className={classes.link}>
					{t('dashboardPage.activity.showHistory')}
				</Link>
			}
		>
			<div aria-busy={isPending}>{renderBody()}</div>
		</SectionCard>
	)
}

export default ActivityFeed
