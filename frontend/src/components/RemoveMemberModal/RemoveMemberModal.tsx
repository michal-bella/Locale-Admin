import { Button, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useTranslation } from 'react-i18next'

import { ERROR_CODE } from '@locale/shared'

import getApiErrorCode from '@/api/getApiErrorCode'
import { useRemoveProjectMemberMutation } from '@/api/projectMembers/useRemoveProjectMemberMutation'
import AppModal from '@/components/AppModal/AppModal'

import { type RemoveMemberModalProps } from './types'

/** Confirmation of "Odobrať z projektu". Only the membership goes away, the account stays. */
const RemoveMemberModal = ({ projectId, opened, member, onClose, onRemoved }: RemoveMemberModalProps) => {
	const { t } = useTranslation()
	const removeMember = useRemoveProjectMemberMutation(projectId)
	const { isPending } = removeMember

	const handleClose = () => {
		if (!isPending) {
			removeMember.reset()
			onClose()
		}
	}

	const handleConfirm = () => {
		if (!member || isPending) {
			return
		}
		removeMember.mutate(member.id, {
			onSuccess: () => {
				notifications.show({ color: 'green', message: t('membersPage.removeModal.success', { email: member.email }) })
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
			opened={opened && member !== null}
			onClose={handleClose}
			title={t('membersPage.removeModal.title')}
			closeLabel={t('membersPage.removeModal.close')}
			isPending={isPending}
			size={440}
			footer={
				<>
					<Button variant='default' onClick={handleClose} disabled={isPending}>
						{t('membersPage.removeModal.cancel')}
					</Button>
					<Button color='red' loading={isPending} onClick={handleConfirm}>
						{t('membersPage.removeModal.confirm')}
					</Button>
				</>
			}
		>
			<Text size='sm'>{member && t('membersPage.removeModal.message', { email: member.email })}</Text>
		</AppModal>
	)
}

export default RemoveMemberModal
