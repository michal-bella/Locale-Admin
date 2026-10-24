import { Badge, Button, Skeleton, Table, Text, VisuallyHidden } from '@mantine/core'
import { type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { ACTIVITY_TYPE_CATEGORY } from '@locale/shared'

import getApiErrorCode from '@/api/getApiErrorCode'
import ActivityAvatar from '@/components/ActivityAvatar/ActivityAvatar'
import ActivityEventLink from '@/components/ActivityEventLink/ActivityEventLink'
import { useDescribeActivity } from '@/hooks/useDescribeActivity'
import { ACTIVITY_CATEGORY_STYLE } from '@/lib/activityCategoryStyle'
import { formatDateTime } from '@/lib/formatDate'
import { formatRelativeTime } from '@/lib/formatRelativeTime'

import classes from './ActivityHistoryTable.module.css'
import { type ActivityHistoryTableProps } from './types'

const SKELETON_ROWS = 8

const COLUMN_COUNT = 6

/**
 * Events of História as a table: when, who, the type as a badge, the sentence of the change, the version and the → of the feed. Below 1200 px
 * the type and the version move under the sentence, as in the versions table; on a phone the name moves above it and only the avatar stays in Kto.
 */
const ActivityHistoryTable = ({ projectSlug, events, error, isRefetching, onRetry, filtered, onResetFilters }: ActivityHistoryTableProps) => {
	const { t, i18n } = useTranslation()
	const describe = useDescribeActivity()
	const now = new Date()

	const stateRow = (content: ReactNode) => (
		<Table.Tr className={classes.tr}>
			<Table.Td colSpan={COLUMN_COUNT} className={`${classes.td} ${classes.state}`}>
				{content}
			</Table.Td>
		</Table.Tr>
	)

	const renderBody = () => {
		if (error) {
			return stateRow(
				<div className='flex flex-col items-center gap-1'>
					<Text size='sm' fw={600} c='var(--app-color-text-strong)'>
						{t('historyPage.table.loadError')}
					</Text>
					<Text size='xs'>{t(`errors.${getApiErrorCode(error)}`)}</Text>
					<Button variant='default' mt='md' loading={isRefetching} onClick={onRetry}>
						{t('historyPage.table.retry')}
					</Button>
				</div>,
			)
		}
		if (!events) {
			return Array.from({ length: SKELETON_ROWS }, (_, index) => (
				<Table.Tr key={index} className={classes.tr}>
					<Table.Td colSpan={COLUMN_COUNT} className={classes.td}>
						<Skeleton height={12} width='50%' radius='sm' />
					</Table.Td>
				</Table.Tr>
			))
		}
		if (events.length === 0) {
			return stateRow(
				filtered ? (
					<div className='flex flex-col items-center gap-3'>
						<Text size='sm'>{t('historyPage.table.emptyFiltered')}</Text>
						<Button variant='default' onClick={onResetFilters}>
							{t('historyPage.filters.reset')}
						</Button>
					</div>
				) : (
					<Text size='sm'>{t('dashboardPage.activity.empty')}</Text>
				),
			)
		}
		return events.map((event) => {
			const category = ACTIVITY_TYPE_CATEGORY[event.type]
			const name = event.user?.name ?? t('dashboardPage.activity.deletedUser')
			const badge = (
				<Badge variant='light' color={ACTIVITY_CATEGORY_STYLE[category].color} radius='xl' size='sm' classNames={{ root: classes.badge }}>
					{t(`historyPage.categories.${category}`)}
				</Badge>
			)
			return (
				<Table.Tr key={event.id} className={classes.tr}>
					<Table.Td className={`${classes.td} ${classes.timeCell}`}>
						<time dateTime={event.createdAt} className={classes.time}>
							{formatDateTime(event.createdAt, i18n.language)}
						</time>
						<Text component='span' className={`${classes.meta} block`}>
							{formatRelativeTime(event.createdAt, i18n.language, now, 'short')}
						</Text>
					</Table.Td>
					<Table.Td className={classes.td}>
						<div className='flex items-center gap-3'>
							<ActivityAvatar event={event} />
							<span className={`${classes.name} ${classes.notOnPhone}`}>{name}</span>
						</div>
					</Table.Td>
					<Table.Td className={`${classes.td} ${classes.wideOnly}`}>{badge}</Table.Td>
					<Table.Td className={classes.td}>
						<span className={`${classes.name} ${classes.phoneOnly}`}>{name}</span>
						<span className={classes.sentence}>{describe(event)}</span>
						<div className={`${classes.narrowOnly} mt-1 flex flex-wrap items-center gap-2`}>
							{badge}
							{event.version && (
								<Text component='span' className={classes.meta}>
									{event.version.name}
								</Text>
							)}
						</div>
					</Table.Td>
					<Table.Td className={`${classes.td} ${classes.wideOnly}`}>
						<Text size='sm'>{event.version?.name ?? '–'}</Text>
					</Table.Td>
					<Table.Td className={`${classes.td} ${classes.actionsCell}`}>
						<ActivityEventLink event={event} projectSlug={projectSlug} now={now} />
					</Table.Td>
				</Table.Tr>
			)
		})
	}

	return (
		<div className={classes.card}>
			<Table aria-label={t('historyPage.table.label')} aria-busy={!events && !error} withRowBorders={false}>
				<Table.Thead>
					<Table.Tr>
						<Table.Th className={`${classes.th} ${classes.timeColumn}`}>{t('historyPage.table.time')}</Table.Th>
						<Table.Th className={`${classes.th} ${classes.userColumn}`}>{t('historyPage.table.user')}</Table.Th>
						<Table.Th className={`${classes.th} ${classes.categoryColumn} ${classes.wideOnly}`}>{t('historyPage.table.category')}</Table.Th>
						<Table.Th className={classes.th}>{t('historyPage.table.change')}</Table.Th>
						<Table.Th className={`${classes.th} ${classes.versionColumn} ${classes.wideOnly}`}>{t('historyPage.table.version')}</Table.Th>
						<Table.Th className={`${classes.th} ${classes.actionsColumn}`}>
							<VisuallyHidden>{t('historyPage.table.actionsColumn')}</VisuallyHidden>
						</Table.Th>
					</Table.Tr>
				</Table.Thead>
				<Table.Tbody>{renderBody()}</Table.Tbody>
			</Table>
		</div>
	)
}

export default ActivityHistoryTable
