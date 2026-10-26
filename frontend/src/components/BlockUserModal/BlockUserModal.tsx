import { Button, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useTranslation } from 'react-i18next'

import { useUpdateUserMutation } from '@/api/adminUsers/useUpdateUserMutation'
import getApiErrorCode from '@/api/getApiErrorCode'
import AppModal from '@/components/AppModal/AppModal'

import { type BlockUserModalProps } from './types'

/** Confirmation of Zablokovať / Odblokovať on the user detail. Blocking signs the user out and stops both password and Google sign-in. */
const BlockUserModal = ({ user, action, opened, onClose }: BlockUserModalProps) => {
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
			{ isActive: action === 'unblock' },
			{
				onSuccess: () => {
					notifications.show({ color: 'green', message: t(`userPage.blockModal.${action}.success`, { email: user.email }) })
					onClose()
				},
				onError: (error) => {
					notifications.show({ color: 'red', message: t(`errors.${getApiErrorCode(error)}`) })
					onClose()
				},
			},
		)
	}

	return (
		<AppModal
			opened={opened}
			onClose={handleClose}
			title={t(`userPage.blockModal.${action}.title`)}
			closeLabel={t('userPage.blockModal.close')}
			isPending={isPending}
			size={480}
			footer={
				<>
					<Button variant='default' onClick={handleClose} disabled={isPending}>
						{t('userPage.blockModal.cancel')}
					</Button>
					<Button color={action === 'block' ? 'red' : undefined} loading={isPending} onClick={handleConfirm}>
						{t(`userPage.blockModal.${action}.confirm`)}
					</Button>
				</>
			}
		>
			<Text size='sm'>{t(`userPage.blockModal.${action}.message`, { email: user.email })}</Text>
		</AppModal>
	)
}

export default BlockUserModal
