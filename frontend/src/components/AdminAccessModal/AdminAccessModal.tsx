import { Button, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useTranslation } from 'react-i18next'

import { ROLE } from '@locale/shared'

import { useUpdateUserMutation } from '@/api/adminUsers/useUpdateUserMutation'
import getApiErrorCode from '@/api/getApiErrorCode'
import AppModal from '@/components/AppModal/AppModal'

import { type AdminAccessModalProps } from './types'

const ADMIN_RIGHTS = ['projects', 'createProjects', 'users', 'members'] as const

/**
 * Confirmation before the Administrátor switch on the user detail saves. Granting lists what an ADMIN may do; revoking lists the projects
 * and roles that apply again (the memberships are kept while the user is an ADMIN).
 */
const AdminAccessModal = ({ user, action, opened, onClose }: AdminAccessModalProps) => {
	const { t } = useTranslation()
	const updateUser = useUpdateUserMutation(user.id)
	const { isPending } = updateUser

	const handleClose = () => {
		if (!isPending) {
			updateUser.reset()
			onClose()
		}
	}

	const handleConfirm = () => {
		if (isPending) {
			return
		}
		updateUser.mutate(
			{ role: action === 'grant' ? ROLE.ADMIN : ROLE.USER },
			{
				onSuccess: () => {
					notifications.show({ color: 'green', message: t('userPage.card.roleSaved') })
					onClose()
				},
				onError: (error) => {
					notifications.show({ color: 'red', message: t(`errors.${getApiErrorCode(error)}`) })
					onClose()
				},
			},
		)
	}

	const renderBody = () => {
		if (action === 'grant') {
			return (
				<>
					<Text size='sm'>{t('userPage.adminModal.grant.message', { email: user.email })}</Text>
					<ul className='flex list-disc flex-col gap-1 pl-5'>
						{ADMIN_RIGHTS.map((right) => (
							<li key={right}>
								<Text size='sm'>{t(`userPage.adminModal.grant.rights.${right}`)}</Text>
							</li>
						))}
					</ul>
					<Text size='sm'>{t('userPage.adminModal.grant.kept')}</Text>
				</>
			)
		}
		if (user.projects.length === 0) {
			return <Text size='sm'>{t('userPage.adminModal.revoke.noProjects', { email: user.email })}</Text>
		}
		return (
			<>
				<Text size='sm'>{t('userPage.adminModal.revoke.message', { email: user.email })}</Text>
				<ul aria-label={t('userPage.adminModal.revoke.projectsLabel')} className='flex list-disc flex-col gap-1 pl-5'>
					{user.projects.map((project) => (
						<li key={project.id}>
							<Text size='sm'>{t('userPage.adminModal.revoke.project', { name: project.name, role: t(`roles.${project.role}`) })}</Text>
						</li>
					))}
				</ul>
			</>
		)
	}

	return (
		<AppModal
			opened={opened}
			onClose={handleClose}
			title={t(`userPage.adminModal.${action}.title`)}
			closeLabel={t('userPage.adminModal.close')}
			isPending={isPending}
			size={480}
			footer={
				<>
					<Button variant='default' onClick={handleClose} disabled={isPending}>
						{t('userPage.adminModal.cancel')}
					</Button>
					<Button color={action === 'revoke' ? 'red' : undefined} loading={isPending} onClick={handleConfirm}>
						{t(`userPage.adminModal.${action}.confirm`)}
					</Button>
				</>
			}
		>
			{renderBody()}
		</AppModal>
	)
}

export default AdminAccessModal
