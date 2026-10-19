import { Button, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useTranslation } from 'react-i18next'

import { ERROR_CODE } from '@locale/shared'

import { useDeleteUserMutation } from '@/api/adminUsers/useDeleteUserMutation'
import getApiErrorCode from '@/api/getApiErrorCode'
import AppModal from '@/components/AppModal/AppModal'

import { type DeleteUserModalProps } from './types'

/** Confirmation of deleting a user account on Používatelia; names the number of projects the user is removed from. */
const DeleteUserModal = ({ opened, user, onClose, onDeleted }: DeleteUserModalProps) => {
	const { t } = useTranslation()
	const deleteUser = useDeleteUserMutation()
	const { isPending } = deleteUser

	const handleClose = () => {
		if (!isPending) {
			deleteUser.reset()
			onClose()
		}
	}

	const handleConfirm = () => {
		if (!user || isPending) {
			return
		}
		deleteUser.mutate(user.id, {
			onSuccess: () => {
				notifications.show({ color: 'green', message: t('usersPage.deleteModal.success', { email: user.email }) })
				onDeleted()
			},
			onError: (error) => {
				const code = getApiErrorCode(error)
				notifications.show({ color: 'red', message: t(`errors.${code}`) })
				if (code === ERROR_CODE.NOT_FOUND) {
					onDeleted()
				}
			},
		})
	}

	return (
		<AppModal
			opened={opened && user !== null}
			onClose={handleClose}
			title={t('usersPage.deleteModal.title')}
			closeLabel={t('usersPage.deleteModal.close')}
			isPending={isPending}
			size={440}
			footer={
				<>
					<Button variant='default' onClick={handleClose} disabled={isPending}>
						{t('usersPage.deleteModal.cancel')}
					</Button>
					<Button color='red' loading={isPending} onClick={handleConfirm}>
						{t('usersPage.deleteModal.confirm')}
					</Button>
				</>
			}
		>
			<Text size='sm'>{user && t('usersPage.deleteModal.message', { email: user.email, count: user.projectCount })}</Text>
		</AppModal>
	)
}

export default DeleteUserModal
