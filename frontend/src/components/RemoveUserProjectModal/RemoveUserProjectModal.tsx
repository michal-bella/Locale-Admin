import { Button, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useTranslation } from 'react-i18next'

import { ERROR_CODE } from '@locale/shared'

import { useRemoveUserProjectMutation } from '@/api/adminUsers/useRemoveUserProjectMutation'
import getApiErrorCode from '@/api/getApiErrorCode'
import AppModal from '@/components/AppModal/AppModal'

import { type RemoveUserProjectModalProps } from './types'

/** Confirmation of "Odobrať z projektu" on the user detail. Only the membership goes away, the account stays. */
const RemoveUserProjectModal = ({ user, opened, project, onClose, onRemoved }: RemoveUserProjectModalProps) => {
	const { t } = useTranslation()
	const removeProject = useRemoveUserProjectMutation(user.id)
	const { isPending } = removeProject

	const handleClose = () => {
		if (!isPending) {
			removeProject.reset()
			onClose()
		}
	}

	const handleConfirm = () => {
		if (!project || isPending) {
			return
		}
		removeProject.mutate(project.id, {
			onSuccess: () => {
				notifications.show({ color: 'green', message: t('userPage.removeModal.success', { email: user.email, name: project.name }) })
				onRemoved()
			},
			onError: (error) => {
				const code = getApiErrorCode(error)
				notifications.show({ color: 'red', message: t(`errors.${code}`) })
				if (code === ERROR_CODE.NOT_FOUND) {
					onRemoved()
				}
			},
		})
	}

	return (
		<AppModal
			opened={opened && project !== null}
			onClose={handleClose}
			title={t('userPage.removeModal.title')}
			closeLabel={t('userPage.removeModal.close')}
			isPending={isPending}
			size={440}
			footer={
				<>
					<Button variant='default' onClick={handleClose} disabled={isPending}>
						{t('userPage.removeModal.cancel')}
					</Button>
					<Button color='red' loading={isPending} onClick={handleConfirm}>
						{t('userPage.removeModal.confirm')}
					</Button>
				</>
			}
		>
			<Text size='sm'>{project && t('userPage.removeModal.message', { email: user.email, name: project.name })}</Text>
		</AppModal>
	)
}

export default RemoveUserProjectModal
