import { Badge, Button, Skeleton, Table, Text, Tooltip, VisuallyHidden } from '@mantine/core'
import { useMergedRef } from '@mantine/hooks'
import { Link } from '@tanstack/react-router'
import { type ReactNode, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { type ProjectVersion, type ProjectVersionState, VERSION_LOCK } from '@locale/shared'

import getApiErrorCode from '@/api/getApiErrorCode'
import { useProjectVersionsQuery } from '@/api/projectVersions/projectVersionsQuery'
import { Edit, Info, Lock, LockUnlocked, Plus, Translate, Trash } from '@/components/Icons'
import RowAction from '@/components/RowAction/RowAction'
import { formatDate, formatDateTime } from '@/lib/formatDate'

import classes from './VersionsTable.module.css'
import { type VersionsTableProps } from './types'

const SKELETON_ROWS = 3

const COLUMN_COUNT = 6

const STATE_COLOR: Record<ProjectVersionState, string> = { UPCOMING: 'gray', ACTIVE: 'green', LOCKED: 'blue' }

const TOOLTIP_EVENTS = { hover: true, focus: false, touch: true } as const

/**
 * Versions of a project in a card like the languages: name with an (i) tooltip of who created it and the last import, the two dates, the key count, the state
 * for today, Otvoriť preklady (the name links there too) and, for an ADMIN, Upraviť, Zamknúť / Odomknúť and Zmazať (not for the current version). Below 1200 px the dates and the key
 * count move under the name, as in the languages table.
 */
const VersionsTable = ({ projectId, projectSlug, onCreate, onEdit, onToggleLock, onDelete, ref }: VersionsTableProps) => {
	const { t, i18n } = useTranslation()
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
			<Table.Td colSpan={COLUMN_COUNT} className={`${classes.td} ${classes.state}`}>
				{content}
			</Table.Td>
		</Table.Tr>
	)

	const dates = (version: ProjectVersion) => (
		<Text component='span' className={classes.meta}>
			{t('versionsPage.table.dates', { startsAt: formatDate(version.startsAt, i18n.language), endsAt: formatDate(version.endsAt, i18n.language) })}
		</Text>
	)

	const infoLines = (version: ProjectVersion) => [
		version.createdBy
			? t('versionsPage.table.createdBy', { name: version.createdBy.name, date: formatDateTime(version.createdAt, i18n.language) })
			: t('versionsPage.table.createdAt', { date: formatDateTime(version.createdAt, i18n.language) }),
		...(version.importedAt === null ? [] : [t('versionsPage.table.importedAt', { date: formatDateTime(version.importedAt, i18n.language) })]),
	]

	const keyCount = (version: ProjectVersion, long: boolean) =>
		version.importedAt === null
			? t('versionsPage.table.noImport')
			: long
				? t('versionsPage.table.keyCount', { count: version.keyCount })
				: version.keyCount.toLocaleString(i18n.language)

	const renderBody = () => {
		if (isPending) {
			return Array.from({ length: SKELETON_ROWS }, (_, index) => (
				<Table.Tr key={index} className={classes.tr}>
					<Table.Td colSpan={COLUMN_COUNT} className={classes.td}>
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
						<Link to='/projects/$projectSlug/translations' params={{ projectSlug }} search={{ version: version.id }} className={classes.nameLink}>
							{version.name}
						</Link>
						{version.isCurrent && (
							<Badge variant='light' color='brand' radius='xl' size='sm'>
								{t('versionsPage.table.current')}
							</Badge>
						)}
						<Tooltip
							label={infoLines(version).map((line) => (
								<div key={line}>{line}</div>
							))}
							events={TOOLTIP_EVENTS}
							multiline
						>
							<span className={classes.infoIcon}>
								<Info aria-hidden />
								<VisuallyHidden>{infoLines(version).join('; ')}</VisuallyHidden>
							</span>
						</Tooltip>
					</div>
					<div className={`${classes.narrowOnly} mt-1`}>
						{dates(version)}
						<Text component='span' className={`${classes.meta} block`}>
							{keyCount(version, true)}
						</Text>
					</div>
				</Table.Td>
				<Table.Td className={`${classes.td} ${classes.wideOnly}`}>
					<Text size='sm'>{formatDate(version.startsAt, i18n.language)}</Text>
				</Table.Td>
				<Table.Td className={`${classes.td} ${classes.wideOnly}`}>
					<Text size='sm'>{formatDate(version.endsAt, i18n.language)}</Text>
				</Table.Td>
				<Table.Td className={`${classes.td} ${classes.wideOnly}`}>
					<Text size='sm'>{keyCount(version, false)}</Text>
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
				<Table.Td className={`${classes.td} ${classes.actionsCell}`}>
					<div className={classes.actions}>
						<RowAction
							icon={Translate}
							tooltip={t('versionsPage.table.open')}
							label={t('versionsPage.table.openLabel', { name: version.name })}
							to='/projects/$projectSlug/translations'
							params={{ projectSlug }}
							search={{ version: version.id }}
						/>
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
						{onDelete && !version.isCurrent && (
							<RowAction
								icon={Trash}
								tooltip={t('versionsPage.table.delete')}
								label={t('versionsPage.table.deleteLabel', { name: version.name })}
								danger
								onClick={(event) => onDelete(version, event.currentTarget)}
							/>
						)}
					</div>
				</Table.Td>
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
						<Table.Th className={`${classes.th} ${classes.keysColumn} ${classes.wideOnly}`}>{t('versionsPage.table.keys')}</Table.Th>
						<Table.Th className={`${classes.th} ${classes.stateColumn}`}>{t('versionsPage.table.state')}</Table.Th>
						<Table.Th className={`${classes.th} ${classes.actionsColumn}`}>
							<VisuallyHidden>{t('versionsPage.table.actionsColumn')}</VisuallyHidden>
						</Table.Th>
					</Table.Tr>
				</Table.Thead>
				<Table.Tbody>{renderBody()}</Table.Tbody>
			</Table>
		</div>
	)
}

export default VersionsTable
