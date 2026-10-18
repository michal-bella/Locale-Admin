import { ActionIcon, Avatar, Button, Menu, Skeleton, Table, Text, VisuallyHidden } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { type ReactNode, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getInitials, type ProjectMember } from '@locale/shared'

import { useMeQuery } from '@/api/auth/meQuery'
import getApiErrorCode from '@/api/getApiErrorCode'
import { useProjectMembersQuery } from '@/api/projectMembers/projectMembersQuery'
import { DotsHorizontal } from '@/components/Icons'
import RemoveMemberModal from '@/components/RemoveMemberModal/RemoveMemberModal'
import { formatDate } from '@/lib/formatDate'

import classes from './MembersTable.module.css'
import { type MembersTableProps } from './types'

const SKELETON_ROWS = 3

type RowActionsProps = { member: ProjectMember; onRemove: (member: ProjectMember, trigger: HTMLButtonElement | null) => void }

const RowActions = ({ member, onRemove }: RowActionsProps) => {
	const { t } = useTranslation()
	const triggerRef = useRef<HTMLButtonElement>(null)

	return (
		<Menu position='bottom-end' width={200} radius='lg' shadow='md'>
			<Menu.Target>
				<ActionIcon
					ref={triggerRef}
					variant='transparent'
					size={34}
					radius='sm'
					aria-label={t('membersPage.table.actions', { email: member.email })}
					className={classes.menuButton}
				>
					<DotsHorizontal aria-hidden />
				</ActionIcon>
			</Menu.Target>
			<Menu.Dropdown>
				<Menu.Item color='red' onClick={() => onRemove(member, triggerRef.current)}>
					{t('membersPage.table.remove')}
				</Menu.Item>
			</Menu.Dropdown>
		</Menu>
	)
}

/**
 * Members of a project in a card, same look and states as the users table. Every member can remove another one;
 * the own row has no menu, leaving goes through Opustiť projekt.
 */
const MembersTable = ({ projectId }: MembersTableProps) => {
	const { t, i18n } = useTranslation()
	const { data, isPending, isError, error, refetch, isRefetching } = useProjectMembersQuery(projectId)
	const { data: me } = useMeQuery()
	const tableRef = useRef<HTMLTableElement>(null)
	const triggerRef = useRef<HTMLButtonElement | null>(null)
	const [removeOpened, removeModal] = useDisclosure(false)
	const [removing, setRemoving] = useState<ProjectMember | null>(null)

	const openRemove = (member: ProjectMember, trigger: HTMLButtonElement | null) => {
		triggerRef.current = trigger
		setRemoving(member)
		removeModal.open()
	}

	// Mantine returns focus to the item of the closed row menu; deferred so a removed row is already gone and the table gets focus instead.
	const closeRemove = () => {
		removeModal.close()
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
						{t('membersPage.table.loadError')}
					</Text>
					<Text size='xs'>{t(`errors.${getApiErrorCode(error)}`)}</Text>
					<Button variant='default' mt='md' loading={isRefetching} onClick={() => void retry()}>
						{t('membersPage.table.retry')}
					</Button>
				</div>,
			)
		}
		if (data.members.length === 0) {
			return stateRow(<Text size='sm'>{t('membersPage.table.empty')}</Text>)
		}
		return data.members.map((member) => {
			const fullName = [member.firstName, member.lastName].filter(Boolean).join(' ')
			return (
				<Table.Tr key={member.id} className={classes.tr}>
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
								{getInitials(member)}
							</Avatar>
							<div className='flex min-w-0 flex-col'>
								<Text size='sm' fw={500} c='var(--app-color-text-strong)' className={classes.email}>
									{fullName || member.email}
								</Text>
								{fullName && (
									<Text size='xs' className={classes.email}>
										{member.email}
									</Text>
								)}
							</div>
						</div>
					</Table.Td>
					<Table.Td className={classes.td}>
						<Text size='xs'>{formatDate(member.createdAt, i18n.language)}</Text>
					</Table.Td>
					<Table.Td className={`${classes.td} ${classes.actionsCell}`}>
						{member.id !== me?.id && <RowActions member={member} onRemove={openRemove} />}
					</Table.Td>
				</Table.Tr>
			)
		})
	}

	return (
		<div className={classes.card}>
			<Table ref={tableRef} tabIndex={-1} aria-label={t('membersPage.table.label')} aria-busy={isPending} withRowBorders={false}>
				<Table.Thead>
					<Table.Tr>
						<Table.Th className={classes.th}>{t('membersPage.table.member')}</Table.Th>
						<Table.Th className={`${classes.th} ${classes.joinedColumn}`}>{t('membersPage.table.joinedAt')}</Table.Th>
						<Table.Th className={`${classes.th} ${classes.actionsColumn}`}>
							<VisuallyHidden>{t('membersPage.table.actionsColumn')}</VisuallyHidden>
						</Table.Th>
					</Table.Tr>
				</Table.Thead>
				<Table.Tbody>{renderBody()}</Table.Tbody>
			</Table>
			<RemoveMemberModal
				projectId={projectId}
				opened={removeOpened}
				member={removing}
				onClose={closeRemove}
				onRemoved={() => {
					triggerRef.current = null
					closeRemove()
				}}
			/>
		</div>
	)
}

export default MembersTable
