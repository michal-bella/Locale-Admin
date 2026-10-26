import { Table, Text, VisuallyHidden } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { type AdminUserProject, type PROJECT_ROLE, ROLE } from '@locale/shared'

import getApiErrorCode from '@/api/getApiErrorCode'
import { useUpdateProjectMemberMutation } from '@/api/projectMembers/useUpdateProjectMemberMutation'
import { ArrowRight, UserMinus } from '@/components/Icons'
import ProjectRoleSelect from '@/components/ProjectRoleSelect/ProjectRoleSelect'
import RemoveUserProjectModal from '@/components/RemoveUserProjectModal/RemoveUserProjectModal'
import RoleBadge from '@/components/RoleBadge/RoleBadge'
import RowAction from '@/components/RowAction/RowAction'
import { formatDate } from '@/lib/formatDate'
import { getProjectInitials, isLightColor } from '@/lib/utils'

import classes from './UserProjectsTable.module.css'
import { type UserProjectsTableProps } from './types'

/** Projects of one user in a card, same look as the admin projects table. Each row changes the user's role in the project, opens the project's members or removes the user from it. */
const UserProjectsTable = ({ user }: UserProjectsTableProps) => {
	const { t, i18n } = useTranslation()
	const tableRef = useRef<HTMLTableElement>(null)
	const triggerRef = useRef<HTMLButtonElement | null>(null)
	const [removeOpened, removeModal] = useDisclosure(false)
	const [removing, setRemoving] = useState<AdminUserProject | null>(null)
	const updateRole = useUpdateProjectMemberMutation()

	const changeRole = (project: AdminUserProject, role: PROJECT_ROLE) => {
		if (role === project.role || updateRole.isPending) {
			return
		}
		updateRole.mutate(
			{ projectId: project.id, userId: user.id, role },
			{
				onSuccess: () => notifications.show({ color: 'green', message: t('projectRole.saved') }),
				onError: (error) => notifications.show({ color: 'red', message: t(`errors.${getApiErrorCode(error)}`) }),
			},
		)
	}

	const openRemove = (project: AdminUserProject, trigger: HTMLButtonElement | null) => {
		triggerRef.current = trigger
		setRemoving(project)
		removeModal.open()
	}

	// Deferred so a removed row is already gone and the table gets focus instead of its button.
	const closeRemove = () => {
		removeModal.close()
		setTimeout(() => (triggerRef.current?.isConnected ? triggerRef.current : tableRef.current)?.focus())
	}

	const renderBody = () => {
		if (user.projects.length === 0) {
			return (
				<Table.Tr className={classes.tr}>
					<Table.Td colSpan={5} className={`${classes.td} ${classes.state}`}>
						<Text size='sm'>{t('userPage.projects.table.empty')}</Text>
					</Table.Td>
				</Table.Tr>
			)
		}
		return user.projects.map((project) => {
			// An ADMIN's memberships are kept for a later demotion; until then the ADMIN role applies in every project.
			const role =
				user.role === ROLE.ADMIN ? (
					<RoleBadge role={ROLE.ADMIN} />
				) : (
					<ProjectRoleSelect
						ariaLabel={t('projectRole.projectLabel', { name: project.name })}
						value={project.role}
						onChange={(picked) => changeRole(project, picked)}
						disabled={updateRole.isPending}
					/>
				)
			return (
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
							<div className='flex min-w-0 flex-col'>
								<Text size='sm' fw={500} c='var(--app-color-text-strong)' className={classes.name}>
									{project.name}
								</Text>
								<Text size='xs' className={`${classes.name} ${classes.narrowOnly}`}>
									{project.slug}
								</Text>
								<Text size='xs' className={classes.narrowOnly}>
									{t('userPage.projects.table.joinedOn', { date: formatDate(project.joinedAt, i18n.language) })}
								</Text>
								<div className={classes.phoneOnly}>{role}</div>
							</div>
						</div>
					</Table.Td>
					<Table.Td className={`${classes.td} ${classes.slugColumn}`}>
						<Text size='xs' className={classes.name}>
							{project.slug}
						</Text>
					</Table.Td>
					<Table.Td className={`${classes.td} ${classes.roleColumn}`}>{role}</Table.Td>
					<Table.Td className={`${classes.td} ${classes.joinedColumn}`}>
						<Text size='xs'>{formatDate(project.joinedAt, i18n.language)}</Text>
					</Table.Td>
					<Table.Td className={`${classes.td} ${classes.actionsCell}`}>
						<div className='flex items-center justify-end gap-1'>
							<RowAction
								icon={ArrowRight}
								tooltip={t('userPage.projects.table.open')}
								label={t('userPage.projects.table.openLabel', { name: project.name })}
								to='/projects/$projectSlug/members'
								params={{ projectSlug: project.slug }}
							/>
							<RowAction
								icon={UserMinus}
								tooltip={t('userPage.projects.table.remove')}
								label={t('userPage.projects.table.removeLabel', { name: project.name })}
								danger
								onClick={(event) => openRemove(project, event.currentTarget)}
							/>
						</div>
					</Table.Td>
				</Table.Tr>
			)
		})
	}

	return (
		<div className={classes.card}>
			<Table ref={tableRef} tabIndex={-1} aria-label={t('userPage.projects.table.label')} withRowBorders={false}>
				<Table.Thead>
					<Table.Tr>
						<Table.Th className={classes.th}>{t('userPage.projects.table.project')}</Table.Th>
						<Table.Th className={`${classes.th} ${classes.slugColumn}`}>{t('userPage.projects.table.slug')}</Table.Th>
						<Table.Th className={`${classes.th} ${classes.roleColumn}`}>{t('userPage.projects.table.role')}</Table.Th>
						<Table.Th className={`${classes.th} ${classes.joinedColumn}`}>{t('userPage.projects.table.joinedAt')}</Table.Th>
						<Table.Th className={`${classes.th} ${classes.actionsColumn}`}>
							<VisuallyHidden>{t('userPage.projects.table.actionsColumn')}</VisuallyHidden>
						</Table.Th>
					</Table.Tr>
				</Table.Thead>
				<Table.Tbody>{renderBody()}</Table.Tbody>
			</Table>
			<RemoveUserProjectModal
				user={user}
				opened={removeOpened}
				project={removing}
				onClose={closeRemove}
				onRemoved={() => {
					triggerRef.current = null
					closeRemove()
				}}
			/>
		</div>
	)
}

export default UserProjectsTable
