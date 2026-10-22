import { Button, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { ERROR_CODE } from '@locale/shared'

import getApiErrorCode from '@/api/getApiErrorCode'
import { useDeleteProjectVersionMutation } from '@/api/projectVersions/useDeleteProjectVersionMutation'
import { QUERY_KEYS } from '@/api/queryKeys'
import AppModal from '@/components/AppModal/AppModal'

import { type DeleteVersionModalProps } from './types'

/** Confirmation before deleting a version: its keys and translations go with it, the other versions keep their copies. */
const DeleteVersionModal = ({ projectId, opened, version, onClose }: DeleteVersionModalProps) => {
	const { t } = useTranslation()
	const queryClient = useQueryClient()
	const deleteVersion = useDeleteProjectVersionMutation(projectId)
	const { isPending } = deleteVersion

	const handleClose = () => {
		if (!isPending) {
			deleteVersion.reset()
			onClose()
		}
	}

	const handleConfirm = () => {
		if (!version || isPending) {
			return
		}
		deleteVersion.mutate(version.id, {
			onSuccess: () => {
				notifications.show({ color: 'green', message: t('versionsPage.deleteModal.success', { name: version.name }) })
				onClose()
			},
			onError: (error) => {
				const code = getApiErrorCode(error)
				notifications.show({ color: 'red', message: t(`errors.${code}`) })
				if (code === ERROR_CODE.PROJECT_VERSION_NOT_FOUND) {
					void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROJECTS.VERSIONS(projectId) })
					onClose()
				}
			},
		})
	}

	return (
		<AppModal
			opened={opened && version !== null}
			onClose={handleClose}
			title={t('versionsPage.deleteModal.title')}
			closeLabel={t('versionsPage.deleteModal.close')}
			isPending={isPending}
			size={440}
			footer={
				<>
					<Button variant='default' onClick={handleClose} disabled={isPending}>
						{t('versionsPage.deleteModal.cancel')}
					</Button>
					<Button color='red' loading={isPending} onClick={handleConfirm}>
						{t('versionsPage.deleteModal.confirm')}
					</Button>
				</>
			}
		>
			<Text size='sm'>{version && t('versionsPage.deleteModal.message', { name: version.name, count: version.keyCount })}</Text>
		</AppModal>
	)
}

export default DeleteVersionModal
