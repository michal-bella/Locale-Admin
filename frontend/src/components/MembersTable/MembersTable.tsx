import { Avatar, Button, Skeleton, Table, Text, VisuallyHidden } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useParams } from '@tanstack/react-router'
import { type ReactNode, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { getInitials, type PROJECT_ROLE, type ProjectMember, ROLE } from '@locale/shared'

import { useMeQuery } from '@/api/auth/meQuery'
import getApiErrorCode from '@/api/getApiErrorCode'
import { useProjectMembersQuery } from '@/api/projectMembers/projectMembersQuery'
import { useUpdateProjectMemberMutation } from '@/api/projectMembers/useUpdateProjectMemberMutation'
import { ArrowRight, UserMinus } from '@/components/Icons'
import ProjectRoleSelect from '@/components/ProjectRoleSelect/ProjectRoleSelect'
import RemoveMemberModal from '@/components/RemoveMemberModal/RemoveMemberModal'
import RoleBadge from '@/components/RoleBadge/RoleBadge'
import RowAction from '@/components/RowAction/RowAction'
import { formatDate } from '@/lib/formatDate'

import classes from './MembersTable.module.css'
import { type MembersTableProps } from './types'

const SKELETON_ROWS = 3

/**
 * Members of a project in a card with the same columns, look and states as the users table. A member sees the role and
 * project count too; only an ADMIN changes the role (a select that saves on change), opens the user detail (the route is ADMIN only) and removes members, the actions
 * column stays so the layout does not depend on the role. The own row has no remove button, leaving goes through
 * Opustiť projekt.
 */
const MembersTable = ({ projectId }: MembersTableProps) => {
	const { t, i18n } = useTranslation()
	const { data, isPending, isError, error, refetch, isRefetching } = useProjectMembersQuery(projectId)
	const { data: me } = useMeQuery()
	const { projectSlug } = useParams({ from: '/_authenticated/_app/projects/$projectSlug' })
	const tableRef = useRef<HTMLTableElement>(null)
	const triggerRef = useRef<HTMLButtonElement | null>(null)
	const [removeOpened, removeModal] = useDisclosure(false)
	const [removing, setRemoving] = useState<ProjectMember | null>(null)
	const isAdmin = me?.role === ROLE.ADMIN
	const updateRole = useUpdateProjectMemberMutation()

	const changeRole = (member: ProjectMember, role: PROJECT_ROLE) => {
		if (role === member.role || updateRole.isPending) {
			return
		}
		updateRole.mutate(
			{ projectId, userId: member.id, role },
			{
				onSuccess: () => notifications.show({ color: 'green', message: t('projectRole.saved') }),
				onError: (mutationError) => notifications.show({ color: 'red', message: t(`errors.${getApiErrorCode(mutationError)}`) }),
			},
		)
	}

	const openRemove = (member: ProjectMember, trigger: HTMLButtonElement | null) => {
		triggerRef.current = trigger
		setRemoving(member)
		removeModal.open()
	}

	// Deferred so a removed row is already gone and the table gets focus instead of its button.
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
			const role = isAdmin ? (
				<ProjectRoleSelect
					ariaLabel={t('projectRole.memberLabel', { email: member.email })}
					value={member.role}
					onChange={(picked) => changeRole(member, picked)}
					disabled={updateRole.isPending}
				/>
			) : (
				<RoleBadge role={member.role} />
			)
			const fullName = [member.firstName, member.lastName].filter(Boolean).join(' ')
			// A long email breaks after the @ first, not inside the domain.
			const email = member.email.split('@').map((part, index) => (index === 0 ? part : [<wbr key={index} />, `@${part}`]))
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
							<div className='flex min-w-0 flex-col gap-1'>
								<Text size='sm' fw={500} c='var(--app-color-text-strong)' className={classes.email}>
									{fullName || email}
								</Text>
								{fullName && (
									<Text size='xs' className={classes.email}>
										{email}
									</Text>
								)}
								<div className={`${classes.narrowDetails} flex-col items-start gap-1`}>
									<span className={classes.phoneOnly}>{role}</span>
									<Text size='xs'>
										{t('membersPage.table.projectCount', { count: member.projectCount })} ·{' '}
										{t('membersPage.table.joinedOn', { date: formatDate(member.createdAt, i18n.language) })}
									</Text>
								</div>
							</div>
						</div>
					</Table.Td>
					<Table.Td className={`${classes.td} ${classes.tabletUp}`}>{role}</Table.Td>
					<Table.Td className={`${classes.td} ${classes.wideOnly}`}>
						<Text size='sm'>{member.projectCount}</Text>
					</Table.Td>
					<Table.Td className={`${classes.td} ${classes.wideOnly}`}>
						<Text size='xs'>{formatDate(member.createdAt, i18n.language)}</Text>
					</Table.Td>
					<Table.Td className={`${classes.td} ${classes.actionsCell}`}>
						{isAdmin && (
							<div className='flex items-center justify-end gap-1'>
								<RowAction
									icon={ArrowRight}
									tooltip={t('membersPage.table.open')}
									label={t('membersPage.table.openLabel', { email: member.email })}
									to='/admin/users/$userId'
									params={{ userId: member.id }}
									search={{ from: projectSlug }}
								/>
								{member.id !== me.id && (
									<RowAction
										icon={UserMinus}
										tooltip={t('membersPage.table.remove')}
										label={t('membersPage.table.removeLabel', { email: member.email })}
										danger
										onClick={(event) => openRemove(member, event.currentTarget)}
									/>
								)}
							</div>
						)}
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
						<Table.Th className={`${classes.th} ${classes.roleColumn} ${classes.tabletUp}`}>{t('membersPage.table.role')}</Table.Th>
						<Table.Th className={`${classes.th} ${classes.projectsColumn} ${classes.wideOnly}`}>{t('membersPage.table.projects')}</Table.Th>
						<Table.Th className={`${classes.th} ${classes.joinedColumn} ${classes.wideOnly}`}>{t('membersPage.table.joinedAt')}</Table.Th>
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
