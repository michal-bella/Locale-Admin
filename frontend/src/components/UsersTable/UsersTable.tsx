import { ActionIcon, Avatar, Button, Menu, Skeleton, Table, Text, VisuallyHidden } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { type ReactNode, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { type AdminUser, getInitials } from '@locale/shared'

import { useAdminUsersQuery } from '@/api/adminUsers/adminUsersQuery'
import { useMeQuery } from '@/api/auth/meQuery'
import getApiErrorCode from '@/api/getApiErrorCode'
import DeleteAdminModal from '@/components/DeleteAdminModal/DeleteAdminModal'
import { DotsHorizontal } from '@/components/Icons'
import { formatDate } from '@/lib/formatDate'

import classes from './UsersTable.module.css'

const SKELETON_ROWS = 3

type RowActionsProps = { user: AdminUser; onDelete: (user: AdminUser, trigger: HTMLButtonElement | null) => void }

const RowActions = ({ user, onDelete }: RowActionsProps) => {
	const { t } = useTranslation()
	const triggerRef = useRef<HTMLButtonElement>(null)

	return (
		<Menu position='bottom-end' width={180} radius='lg' shadow='md'>
			<Menu.Target>
				<ActionIcon
					ref={triggerRef}
					variant='transparent'
					size={34}
					radius='sm'
					aria-label={t('usersPage.table.actions', { email: user.email })}
					className={classes.menuButton}
				>
					<DotsHorizontal aria-hidden />
				</ActionIcon>
			</Menu.Target>
			<Menu.Dropdown>
				<Menu.Item color='red' onClick={() => onDelete(user, triggerRef.current)}>
					{t('usersPage.table.delete')}
				</Menu.Item>
			</Menu.Dropdown>
		</Menu>
	)
}

/** Admin list in a card (Figma 28:2) with loading, empty and error states. Every row but the own one can be deleted. */
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

	// Mantine returns focus to the item of the closed row menu; deferred so a deleted row is already gone and the table gets focus instead.
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
			<Table.Td colSpan={3} className={`${classes.td} ${classes.state}`}>
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
					<Table.Td className={classes.td}>
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
						<Text size='sm' fw={500} c='var(--app-color-text-strong)' className={classes.email}>
							{user.email}
						</Text>
					</div>
				</Table.Td>
				<Table.Td className={classes.td}>
					<Text size='xs'>{formatDate(user.createdAt, i18n.language)}</Text>
				</Table.Td>
				<Table.Td className={`${classes.td} ${classes.actionsCell}`}>{user.id !== me?.id && <RowActions user={user} onDelete={openDelete} />}</Table.Td>
			</Table.Tr>
		))
	}

	return (
		<div className={classes.card}>
			<Table ref={tableRef} tabIndex={-1} aria-label={t('usersPage.table.label')} aria-busy={isPending} withRowBorders={false}>
				<Table.Thead>
					<Table.Tr>
						<Table.Th className={classes.th}>{t('usersPage.table.email')}</Table.Th>
						<Table.Th className={`${classes.th} ${classes.createdColumn}`}>{t('usersPage.table.createdAt')}</Table.Th>
						<Table.Th className={`${classes.th} ${classes.actionsColumn}`}>
							<VisuallyHidden>{t('usersPage.table.actionsColumn')}</VisuallyHidden>
						</Table.Th>
					</Table.Tr>
				</Table.Thead>
				<Table.Tbody>{renderBody()}</Table.Tbody>
			</Table>
			<DeleteAdminModal
				opened={deleteOpened}
				admin={deleting}
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
