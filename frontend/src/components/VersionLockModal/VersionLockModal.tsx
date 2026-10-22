import { Button, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { ERROR_CODE, VERSION_LOCK } from '@locale/shared'

import getApiErrorCode from '@/api/getApiErrorCode'
import { useUpdateProjectVersionMutation } from '@/api/projectVersions/useUpdateProjectVersionMutation'
import { QUERY_KEYS } from '@/api/queryKeys'
import AppModal from '@/components/AppModal/AppModal'

import { type VersionLockModalProps } from './types'

/** Confirmation before locking or unlocking a version: it changes who may write translations of that version. */
const VersionLockModal = ({ projectId, opened, version, onClose }: VersionLockModalProps) => {
	const { t } = useTranslation()
	const queryClient = useQueryClient()
	const updateVersion = useUpdateProjectVersionMutation(projectId)
	const { isPending } = updateVersion
	const action = version?.isLocked ? 'unlock' : 'lock'

	const handleClose = () => {
		if (!isPending) {
			updateVersion.reset()
			onClose()
		}
	}

	const handleConfirm = () => {
		if (!version || isPending) {
			return
		}
		updateVersion.mutate(
			{ versionId: version.id, lock: version.isLocked ? VERSION_LOCK.UNLOCKED : VERSION_LOCK.LOCKED },
			{
				onSuccess: () => {
					notifications.show({ color: 'green', message: t(`versionsPage.lockModal.success.${action}`, { name: version.name }) })
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
			},
		)
	}

	return (
		<AppModal
			opened={opened && version !== null}
			onClose={handleClose}
			title={t(`versionsPage.lockModal.title.${action}`)}
			closeLabel={t('versionsPage.lockModal.close')}
			isPending={isPending}
			size={440}
			footer={
				<>
					<Button variant='default' onClick={handleClose} disabled={isPending}>
						{t('versionsPage.lockModal.cancel')}
					</Button>
					<Button loading={isPending} onClick={handleConfirm}>
						{t(`versionsPage.lockModal.confirm.${action}`)}
					</Button>
				</>
			}
		>
			<Text size='sm'>{version && t(`versionsPage.lockModal.message.${action}`, { name: version.name })}</Text>
		</AppModal>
	)
}

export default VersionLockModal
