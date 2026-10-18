import { Button, Skeleton, Table, Text, VisuallyHidden } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { type AdminProjectListItem } from '@locale/shared'

import { useAdminProjectsQuery } from '@/api/adminProjects/adminProjectsQuery'
import getApiErrorCode from '@/api/getApiErrorCode'
import DeleteProjectModal from '@/components/DeleteProjectModal/DeleteProjectModal'
import EditProjectModal from '@/components/EditProjectModal/EditProjectModal'
import { ArrowRight, Settings, Trash } from '@/components/Icons'
import LanguageFlag from '@/components/LanguageFlag/LanguageFlag'
import RowAction from '@/components/RowAction/RowAction'
import { formatDate } from '@/lib/formatDate'
import { findSupportedLanguage } from '@/lib/languageOptions'
import { getProjectInitials, isLightColor } from '@/lib/utils'

import classes from './AdminProjectsTable.module.css'

const SKELETON_ROWS = 3

const COLUMN_COUNT = 7

/** Every project in a card, same look and states as the users table. Each row can be edited in a modal, opened or deleted. */
const AdminProjectsTable = () => {
	const { t, i18n } = useTranslation()
	const { data, isPending, isError, error, refetch, isRefetching } = useAdminProjectsQuery()
	const tableRef = useRef<HTMLTableElement>(null)
	const triggerRef = useRef<HTMLButtonElement | null>(null)
	const focusTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)
	const [editOpened, editModal] = useDisclosure(false)
	const [editing, setEditing] = useState<AdminProjectListItem | null>(null)
	const [deleteOpened, deleteModal] = useDisclosure(false)
	const [deleting, setDeleting] = useState<AdminProjectListItem | null>(null)

	const openEdit = (project: AdminProjectListItem) => {
		setEditing(project)
		editModal.open()
	}

	const openDelete = (project: AdminProjectListItem, trigger: HTMLButtonElement | null) => {
		triggerRef.current = trigger
		setDeleting(project)
		deleteModal.open()
	}

	// Deferred so a deleted row is already gone and the table gets focus instead of its button.
	const closeDelete = () => {
		deleteModal.close()
		focusTimeoutRef.current = setTimeout(() => (triggerRef.current?.isConnected ? triggerRef.current : tableRef.current)?.focus())
	}

	useEffect(() => () => clearTimeout(focusTimeoutRef.current), [])

	// A successful retry replaces the focused retry button with the rows.
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

	const renderBaseLanguage = (tag: AdminProjectListItem['baseLanguageTag']) => {
		const language = findSupportedLanguage(tag)
		if (!language) {
			return (
				<Text size='xs' c='var(--app-color-muted)'>
					{t('adminProjectsPage.table.noBaseLanguage')}
				</Text>
			)
		}
		return (
			<div className='flex items-center gap-2'>
				<LanguageFlag code={language.flagCode} size='sm' />
				<Text size='sm'>{language.englishName}</Text>
			</div>
		)
	}

	const renderBody = () => {
		if (isPending) {
			return Array.from({ length: SKELETON_ROWS }, (_, index) => (
				<Table.Tr key={index} className={classes.tr}>
					<Table.Td className={classes.td}>
						<div className='flex items-center gap-3'>
							<Skeleton height={32} width={32} radius='sm' />
							<Skeleton height={12} width='60%' radius='sm' />
						</div>
					</Table.Td>
					{Array.from({ length: COLUMN_COUNT - 2 }, (_, cell) => (
						<Table.Td key={cell} className={classes.td}>
							<Skeleton height={12} width='60%' radius='sm' />
						</Table.Td>
					))}
					<Table.Td className={classes.td} />
				</Table.Tr>
			))
		}
		if (isError) {
			return stateRow(
				<div className='flex flex-col items-center gap-1'>
					<Text size='sm' fw={600} c='var(--app-color-text-strong)'>
						{t('adminProjectsPage.table.loadError')}
					</Text>
					<Text size='xs'>{t(`errors.${getApiErrorCode(error)}`)}</Text>
					<Button variant='default' mt='md' loading={isRefetching} onClick={() => void retry()}>
						{t('adminProjectsPage.table.retry')}
					</Button>
				</div>,
			)
		}
		if (data.projects.length === 0) {
			return stateRow(<Text size='sm'>{t('adminProjectsPage.table.empty')}</Text>)
		}
		return data.projects.map((project) => (
			<Table.Tr key={project.id} className={classes.tr}>
				<Table.Td className={classes.td}>
					<div className='flex items-center gap-3'>
						<span
							aria-hidden
							data-tone={isLightColor(project.primaryColor) ? 'dark' : 'light'}
							className={classes.avatar}
							style={{ backgroundColor: project.primaryColor }}
						>
							{getProjectInitials(project.name)}
						</span>
						<Text size='sm' fw={500} c='var(--app-color-text-strong)' className={classes.name}>
							{project.name}
						</Text>
					</div>
				</Table.Td>
				<Table.Td className={classes.td}>
					<Text size='xs' className={classes.name}>
						{project.slug}
					</Text>
				</Table.Td>
				<Table.Td className={classes.td}>{renderBaseLanguage(project.baseLanguageTag)}</Table.Td>
				<Table.Td className={`${classes.td} ${classes.numberColumn}`}>
					<Text size='sm'>{project.languageCount}</Text>
				</Table.Td>
				<Table.Td className={`${classes.td} ${classes.numberColumn}`}>
					<Text size='sm'>{project.memberCount}</Text>
				</Table.Td>
				<Table.Td className={classes.td}>
					<Text size='xs'>{formatDate(project.createdAt, i18n.language)}</Text>
				</Table.Td>
				<Table.Td className={`${classes.td} ${classes.actionsCell}`}>
					<div className='flex items-center justify-end gap-1'>
						<RowAction
							icon={Settings}
							tooltip={t('adminProjectsPage.table.edit')}
							label={t('adminProjectsPage.table.editLabel', { name: project.name })}
							onClick={() => openEdit(project)}
						/>
						<RowAction
							icon={ArrowRight}
							tooltip={t('adminProjectsPage.table.open')}
							label={t('adminProjectsPage.table.openLabel', { name: project.name })}
							to='/projects/$projectSlug/settings'
							params={{ projectSlug: project.slug }}
						/>
						<RowAction
							icon={Trash}
							tooltip={t('adminProjectsPage.table.delete')}
							label={t('adminProjectsPage.table.deleteLabel', { name: project.name })}
							danger
							onClick={(event) => openDelete(project, event.currentTarget)}
						/>
					</div>
				</Table.Td>
			</Table.Tr>
		))
	}

	return (
		<div className={classes.card}>
			<Table ref={tableRef} tabIndex={-1} aria-label={t('adminProjectsPage.table.label')} aria-busy={isPending} withRowBorders={false}>
				<Table.Thead>
					<Table.Tr>
						<Table.Th className={classes.th}>{t('adminProjectsPage.table.project')}</Table.Th>
						<Table.Th className={classes.th}>{t('adminProjectsPage.table.slug')}</Table.Th>
						<Table.Th className={classes.th}>{t('adminProjectsPage.table.baseLanguage')}</Table.Th>
						<Table.Th className={`${classes.th} ${classes.numberColumn}`}>{t('adminProjectsPage.table.languages')}</Table.Th>
						<Table.Th className={`${classes.th} ${classes.numberColumn}`}>{t('adminProjectsPage.table.members')}</Table.Th>
						<Table.Th className={classes.th}>{t('adminProjectsPage.table.createdAt')}</Table.Th>
						<Table.Th className={`${classes.th} ${classes.actionsColumn}`}>
							<VisuallyHidden>{t('adminProjectsPage.table.actionsColumn')}</VisuallyHidden>
						</Table.Th>
					</Table.Tr>
				</Table.Thead>
				<Table.Tbody>{renderBody()}</Table.Tbody>
			</Table>
			<EditProjectModal opened={editOpened} project={editing} onClose={editModal.close} />
			<DeleteProjectModal
				opened={deleteOpened}
				project={deleting}
				onClose={closeDelete}
				onDeleted={() => {
					triggerRef.current = null
					closeDelete()
				}}
			/>
		</div>
	)
}

export default AdminProjectsTable
