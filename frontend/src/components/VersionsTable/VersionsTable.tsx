import { Badge, Button, Skeleton, Table, Text, VisuallyHidden } from '@mantine/core'
import { useMergedRef } from '@mantine/hooks'
import { type ReactNode, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { type ProjectVersion, type ProjectVersionState, VERSION_LOCK } from '@locale/shared'

import getApiErrorCode from '@/api/getApiErrorCode'
import { useProjectVersionsQuery } from '@/api/projectVersions/projectVersionsQuery'
import { Edit, Lock, LockUnlocked, Plus } from '@/components/Icons'
import RowAction from '@/components/RowAction/RowAction'
import { formatDate, formatDateTime } from '@/lib/formatDate'

import classes from './VersionsTable.module.css'
import { type VersionsTableProps } from './types'

const SKELETON_ROWS = 3

const COLUMN_COUNT_WITHOUT_ACTIONS = 4

const STATE_COLOR: Record<ProjectVersionState, string> = { UPCOMING: 'gray', ACTIVE: 'green', LOCKED: 'blue' }

/**
 * Versions of a project in a card like the languages: name with who created it, the two dates, the state for today and, for an ADMIN,
 * Upraviť and Zamknúť / Odomknúť. Below 1200 px the dates move under the name, as in the languages table.
 */
const VersionsTable = ({ projectId, onCreate, onEdit, onToggleLock, ref }: VersionsTableProps) => {
	const { t, i18n } = useTranslation()
	const hasActions = onEdit !== undefined || onToggleLock !== undefined
	const columnCount = hasActions ? COLUMN_COUNT_WITHOUT_ACTIONS + 1 : COLUMN_COUNT_WITHOUT_ACTIONS
	const { data, isPending, isError, error, refetch, isRefetching } = useProjectVersionsQuery(projectId)
	const tableRef = useRef<HTMLTableElement>(null)
	const mergedRef = useMergedRef(tableRef, ref)

	const retry = async () => {
		const { isSuccess } = await refetch()
		if (isSuccess) {
			tableRef.current?.focus()
		}
	}

	const stateRow = (content: ReactNode) => (
		<Table.Tr className={classes.tr}>
			<Table.Td colSpan={columnCount} className={`${classes.td} ${classes.state}`}>
				{content}
			</Table.Td>
		</Table.Tr>
	)

	const dates = (version: ProjectVersion) => (
		<Text component='span' className={classes.meta}>
			{t('versionsPage.table.dates', { startsAt: formatDate(version.startsAt, i18n.language), endsAt: formatDate(version.endsAt, i18n.language) })}
		</Text>
	)

	const renderBody = () => {
		if (isPending) {
			return Array.from({ length: SKELETON_ROWS }, (_, index) => (
				<Table.Tr key={index} className={classes.tr}>
					<Table.Td colSpan={columnCount} className={classes.td}>
						<Skeleton height={12} width='40%' radius='sm' />
					</Table.Td>
				</Table.Tr>
			))
		}
		if (isError) {
			return stateRow(
				<div className='flex flex-col items-center gap-1'>
					<Text size='sm' fw={600} c='var(--app-color-text-strong)'>
						{t('versionsPage.table.loadError')}
					</Text>
					<Text size='xs'>{t(`errors.${getApiErrorCode(error)}`)}</Text>
					<Button variant='default' mt='md' loading={isRefetching} onClick={() => void retry()}>
						{t('versionsPage.table.retry')}
					</Button>
				</div>,
			)
		}
		if (data.items.length === 0) {
			return stateRow(
				<div className='flex flex-col items-center gap-4'>
					<Text size='sm'>{t(onCreate ? 'versionsPage.table.empty' : 'versionsPage.table.emptyEditor')}</Text>
					{onCreate && (
						<Button leftSection={<Plus aria-hidden />} onClick={(event) => onCreate(event.currentTarget)}>
							{t('versionsPage.createButton')}
						</Button>
					)}
				</div>,
			)
		}
		return data.items.map((version) => (
			<Table.Tr key={version.id} className={classes.tr}>
				<Table.Td className={classes.td}>
					<div className='flex flex-wrap items-center gap-x-3 gap-y-1'>
						<Text size='sm' fw={600} c='var(--app-color-text-strong)'>
							{version.name}
						</Text>
						{version.isCurrent && (
							<Badge variant='light' color='brand' radius='xl' size='sm'>
								{t('versionsPage.table.current')}
							</Badge>
						)}
					</div>
					<Text component='span' className={classes.meta}>
						{version.createdBy
							? t('versionsPage.table.createdBy', { name: version.createdBy.name, date: formatDateTime(version.createdAt, i18n.language) })
							: t('versionsPage.table.createdAt', { date: formatDateTime(version.createdAt, i18n.language) })}
					</Text>
					<div className={`${classes.narrowOnly} mt-1`}>{dates(version)}</div>
				</Table.Td>
				<Table.Td className={`${classes.td} ${classes.wideOnly}`}>
					<Text size='sm'>{formatDate(version.startsAt, i18n.language)}</Text>
				</Table.Td>
				<Table.Td className={`${classes.td} ${classes.wideOnly}`}>
					<Text size='sm'>{formatDate(version.endsAt, i18n.language)}</Text>
				</Table.Td>
				<Table.Td className={`${classes.td} ${classes.stateCell}`}>
					<Badge variant='light' color={STATE_COLOR[version.state]} radius='xl' size='sm' classNames={{ root: classes.stateBadge }}>
						{t(`versionsPage.state.${version.state}`)}
					</Badge>
					{version.isLocked && version.lock === VERSION_LOCK.LOCKED && (
						<Text component='span' className={`${classes.meta} block`}>
							{t('versionsPage.table.lockedByHand')}
						</Text>
					)}
					{!version.isLocked && version.lock === VERSION_LOCK.UNLOCKED && (
						<Text component='span' className={`${classes.meta} block`}>
							{t('versionsPage.table.unlockedByHand')}
						</Text>
					)}
				</Table.Td>
				{hasActions && (
					<Table.Td className={`${classes.td} ${classes.actionsCell}`}>
						{onEdit && (
							<RowAction
								icon={Edit}
								tooltip={t('versionsPage.table.edit')}
								label={t('versionsPage.table.editLabel', { name: version.name })}
								onClick={(event) => onEdit(version, event.currentTarget)}
							/>
						)}
						{onToggleLock && (
							<RowAction
								icon={version.isLocked ? LockUnlocked : Lock}
								tooltip={t(version.isLocked ? 'versionsPage.table.unlock' : 'versionsPage.table.lock')}
								label={t(version.isLocked ? 'versionsPage.table.unlockLabel' : 'versionsPage.table.lockLabel', { name: version.name })}
								onClick={(event) => onToggleLock(version, event.currentTarget)}
							/>
						)}
					</Table.Td>
				)}
			</Table.Tr>
		))
	}

	return (
		<div className={classes.card}>
			<Table ref={mergedRef} tabIndex={-1} aria-label={t('versionsPage.table.label')} aria-busy={isPending} withRowBorders={false}>
				<Table.Thead>
					<Table.Tr>
						<Table.Th className={classes.th}>{t('versionsPage.table.version')}</Table.Th>
						<Table.Th className={`${classes.th} ${classes.dateColumn} ${classes.wideOnly}`}>{t('versionsPage.table.startsAt')}</Table.Th>
						<Table.Th className={`${classes.th} ${classes.dateColumn} ${classes.wideOnly}`}>{t('versionsPage.table.endsAt')}</Table.Th>
						<Table.Th className={`${classes.th} ${classes.stateColumn}`}>{t('versionsPage.table.state')}</Table.Th>
						{hasActions && (
							<Table.Th className={`${classes.th} ${classes.actionsColumn}`}>
								<VisuallyHidden>{t('versionsPage.table.actionsColumn')}</VisuallyHidden>
							</Table.Th>
						)}
					</Table.Tr>
				</Table.Thead>
				<Table.Tbody>{renderBody()}</Table.Tbody>
			</Table>
		</div>
	)
}

export default VersionsTable
