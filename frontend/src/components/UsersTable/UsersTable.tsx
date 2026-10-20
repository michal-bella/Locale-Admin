import { Avatar, Button, Skeleton, Table, Text, VisuallyHidden } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { type ReactNode, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { type AdminUser, getInitials } from '@locale/shared'

import { useAdminUsersQuery } from '@/api/adminUsers/adminUsersQuery'
import { useMeQuery } from '@/api/auth/meQuery'
import getApiErrorCode from '@/api/getApiErrorCode'
import DeleteUserModal from '@/components/DeleteUserModal/DeleteUserModal'
import { ArrowRight, Trash } from '@/components/Icons'
import RoleBadge from '@/components/RoleBadge/RoleBadge'
import RowAction from '@/components/RowAction/RowAction'
import { formatDate } from '@/lib/formatDate'

import classes from './UsersTable.module.css'

const SKELETON_ROWS = 3

/** All users (ADMIN and EDITOR) in a card (Figma 28:2) with loading, empty and error states. Every row opens the user detail; every row but the own one can be deleted. */
const UsersTable = () => {
	const { t, i18n } = useTranslation()
	const { data, isPending, isError, error, refetch, isRefetching } = useAdminUsersQuery()
	const { data: me } = useMeQuery()
	const tableRef = useRef<HTMLTableElement>(null)
	const triggerRef = useRef<HTMLButtonElement | null>(null)
	const [deleteOpened, deleteModal] = useDisclosure(false)
	const [deleting, setDeleting] = useState<AdminUser | null>(null)

	const openDelete = (user: AdminUser, trigger: HTMLButtonElement | null) => {
		triggerRef.current = trigger
		setDeleting(user)
		deleteModal.open()
	}

	// Deferred so a deleted row is already gone and the table gets focus instead of its button.
	const closeDelete = () => {
		deleteModal.close()
		setTimeout(() => (triggerRef.current?.isConnected ? triggerRef.current : tableRef.current)?.focus())
	}

	// A successful retry replaces the focused retry button with the rows.
	const retry = async () => {
		const { isSuccess } = await refetch()
		if (isSuccess) {
			tableRef.current?.focus()
		}
	}

	const stateRow = (content: ReactNode) => (
		<Table.Tr className={classes.tr}>
			<Table.Td colSpan={5} className={`${classes.td} ${classes.state}`}>
				{content}
			</Table.Td>
		</Table.Tr>
	)

	const renderBody = () => {
		if (isPending) {
			return Array.from({ length: SKELETON_ROWS }, (_, index) => (
				<Table.Tr key={index} className={classes.tr}>
					<Table.Td className={classes.td}>
						<div className='flex items-center gap-3'>
							<Skeleton circle height={32} />
							<Skeleton height={12} width='40%' radius='sm' />
						</div>
					</Table.Td>
					<Table.Td className={`${classes.td} ${classes.tabletUp}`}>
						<Skeleton height={22} width='4rem' radius='xl' />
					</Table.Td>
					<Table.Td className={`${classes.td} ${classes.wideOnly}`}>
						<Skeleton height={12} width='1.5rem' radius='sm' />
					</Table.Td>
					<Table.Td className={`${classes.td} ${classes.wideOnly}`}>
						<Skeleton height={12} width='60%' radius='sm' />
					</Table.Td>
					<Table.Td className={classes.td} />
				</Table.Tr>
			))
		}
		if (isError) {
			return stateRow(
				<div className='flex flex-col items-center gap-1'>
					<Text size='sm' fw={600} c='var(--app-color-text-strong)'>
						{t('usersPage.table.loadError')}
					</Text>
					<Text size='xs'>{t(`errors.${getApiErrorCode(error)}`)}</Text>
					<Button variant='default' mt='md' loading={isRefetching} onClick={() => void retry()}>
						{t('usersPage.table.retry')}
					</Button>
				</div>,
			)
		}
		if (data.users.length === 0) {
			return stateRow(<Text size='sm'>{t('usersPage.table.empty')}</Text>)
		}
		return data.users.map((user) => (
			<Table.Tr key={user.id} className={classes.tr}>
				<Table.Td className={classes.td}>
					<div className='flex items-center gap-3'>
						<Avatar
							aria-hidden
							size={32}
							radius='xl'
							color='var(--app-color-avatar-muted)'
							variant='filled'
							classNames={{ placeholder: classes.initials }}
						>
							{getInitials({ email: user.email, firstName: null, lastName: null })}
						</Avatar>
						<div className='flex min-w-0 flex-col gap-1'>
							<Text size='sm' fw={500} c='var(--app-color-text-strong)' className={classes.email}>
								{/* A long email breaks after the @ first, not inside the domain. */}
								{user.email.split('@').map((part, index) => (index === 0 ? part : [<wbr key={index} />, `@${part}`]))}
							</Text>
							{/* The hidden columns, for screens too narrow for them (see the CSS). */}
							<div className={`${classes.narrowDetails} flex-col items-start gap-1`}>
								<span className={classes.phoneOnly}>
									<RoleBadge role={user.role} />
								</span>
								<Text size='xs'>
									{t('usersPage.table.projectCount', { count: user.projectCount })} ·{' '}
									{t('usersPage.table.createdOn', { date: formatDate(user.createdAt, i18n.language) })}
								</Text>
							</div>
						</div>
					</div>
				</Table.Td>
				<Table.Td className={`${classes.td} ${classes.tabletUp}`}>
					<RoleBadge role={user.role} />
				</Table.Td>
				<Table.Td className={`${classes.td} ${classes.wideOnly}`}>
					<Text size='sm'>{user.projectCount}</Text>
				</Table.Td>
				<Table.Td className={`${classes.td} ${classes.wideOnly}`}>
					<Text size='xs'>{formatDate(user.createdAt, i18n.language)}</Text>
				</Table.Td>
				<Table.Td className={`${classes.td} ${classes.actionsCell}`}>
					<div className='flex items-center justify-end gap-1'>
						<RowAction
							icon={ArrowRight}
							tooltip={t('usersPage.table.open')}
							label={t('usersPage.table.openLabel', { email: user.email })}
							to='/admin/users/$userId'
							params={{ userId: user.id }}
						/>
						{user.id !== me?.id && (
							<RowAction
								icon={Trash}
								tooltip={t('usersPage.table.delete')}
								label={t('usersPage.table.deleteLabel', { email: user.email })}
								danger
								onClick={(event) => openDelete(user, event.currentTarget)}
							/>
						)}
					</div>
				</Table.Td>
			</Table.Tr>
		))
	}

	return (
		<div className={classes.card}>
			<Table ref={tableRef} tabIndex={-1} aria-label={t('usersPage.table.label')} aria-busy={isPending} withRowBorders={false}>
				<Table.Thead>
					<Table.Tr>
						<Table.Th className={classes.th}>{t('usersPage.table.email')}</Table.Th>
						<Table.Th className={`${classes.th} ${classes.roleColumn} ${classes.tabletUp}`}>{t('usersPage.table.role')}</Table.Th>
						<Table.Th className={`${classes.th} ${classes.projectsColumn} ${classes.wideOnly}`}>{t('usersPage.table.projects')}</Table.Th>
						<Table.Th className={`${classes.th} ${classes.createdColumn} ${classes.wideOnly}`}>{t('usersPage.table.createdAt')}</Table.Th>
						<Table.Th className={`${classes.th} ${classes.actionsColumn}`}>
							<VisuallyHidden>{t('usersPage.table.actionsColumn')}</VisuallyHidden>
						</Table.Th>
					</Table.Tr>
				</Table.Thead>
				<Table.Tbody>{renderBody()}</Table.Tbody>
			</Table>
			<DeleteUserModal
				opened={deleteOpened}
				user={deleting}
				onClose={closeDelete}
				onDeleted={() => {
					triggerRef.current = null
					closeDelete()
				}}
			/>
		</div>
	)
}

export default UsersTable
