import { Button, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { ERROR_CODE } from '@locale/shared'

import getApiErrorCode from '@/api/getApiErrorCode'
import { useLeaveProjectMutation } from '@/api/projects/useLeaveProjectMutation'
import { QUERY_KEYS } from '@/api/queryKeys'
import AppModal from '@/components/AppModal/AppModal'

import { type LeaveProjectModalProps } from './types'

/** Confirmation of "Opustiť projekt" from the project list and from the project settings. */
const LeaveProjectModal = ({ opened, project, onClose, onLeft }: LeaveProjectModalProps) => {
	const { t } = useTranslation()
	const queryClient = useQueryClient()
	const leaveProject = useLeaveProjectMutation()
	const { isPending } = leaveProject

	const handleClose = () => {
		if (!isPending) {
			leaveProject.reset()
			onClose()
		}
	}

	const handleConfirm = () => {
		if (!project || isPending) {
			return
		}
		leaveProject.mutate(project.id, {
			onSuccess: () => {
				notifications.show({ color: 'green', message: t('leaveProjectModal.success', { name: project.name }) })
				onLeft()
			},
			onError: (error) => {
				const code = getApiErrorCode(error)
				notifications.show({ color: 'red', message: t(`errors.${code}`) })
				// Already not a member (left in another tab): the list must stop offering the action.
				if (code === ERROR_CODE.NOT_FOUND) {
					void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROJECTS.LIST() })
					onLeft()
				}
			},
		})
	}

	return (
		<AppModal
			opened={opened && project !== null}
			onClose={handleClose}
			title={t('leaveProjectModal.title')}
			closeLabel={t('leaveProjectModal.close')}
			isPending={isPending}
			size={440}
			footer={
				<>
					<Button variant='default' onClick={handleClose} disabled={isPending}>
						{t('leaveProjectModal.cancel')}
					</Button>
					<Button color='red' loading={isPending} onClick={handleConfirm}>
						{t('leaveProjectModal.confirm')}
					</Button>
				</>
			}
		>
			<Text size='sm'>{project && t('leaveProjectModal.message', { name: project.name })}</Text>
		</AppModal>
	)
}

export default LeaveProjectModal
