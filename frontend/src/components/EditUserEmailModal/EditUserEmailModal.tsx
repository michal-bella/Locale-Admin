import { zodResolver } from '@hookform/resolvers/zod'
import { Button, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { ERROR_CODE, normalizeEmail, toValidationCode, type UpdateUserRequest, updateUserRequestSchema } from '@locale/shared'

import { useUpdateUserMutation } from '@/api/adminUsers/useUpdateUserMutation'
import getApiErrorCode from '@/api/getApiErrorCode'
import getApiErrorDetails from '@/api/getApiErrorDetails'
import AppModal from '@/components/AppModal/AppModal'

import { type EditUserEmailModalProps } from './types'

/** "Upraviť e-mail" on the user detail: the new email the user signs in with. An unchanged email closes without a request. */
const EditUserEmailModal = ({ user, opened, onClose }: EditUserEmailModalProps) => {
	const { t } = useTranslation()
	const updateUser = useUpdateUserMutation(user.id)
	const { isPending } = updateUser
	const {
		register,
		handleSubmit,
		setError,
		reset,
		formState: { errors },
	} = useForm<UpdateUserRequest>({
		resolver: zodResolver(updateUserRequestSchema, {
			error: (issue) => {
				// zod passes a raw issue here; the fields toValidationCode reads (code, input, minimum, maximum, format) match the final issue.
				const { code, params } = toValidationCode(issue as Parameters<typeof toValidationCode>[0])
				return t(`validation.${code}`, params)
			},
		}),
		values: { email: user.email },
	})

	const resetAndClose = () => {
		reset()
		updateUser.reset()
		onClose()
	}

	const handleClose = () => {
		if (!isPending) {
			resetAndClose()
		}
	}

	const onSubmit = handleSubmit(({ email }) => {
		if (isPending) {
			return
		}
		if (email === undefined || email === normalizeEmail(user.email)) {
			resetAndClose()
			return
		}
		updateUser.mutate(
			{ email },
			{
				onSuccess: (saved) => {
					notifications.show({ color: 'green', message: t('userPage.emailModal.success', { email: saved.email }) })
					resetAndClose()
				},
				onError: (error) => {
					const code = getApiErrorCode(error)
					const details = getApiErrorDetails(error)
					if (code === ERROR_CODE.VALIDATION_ERROR && details[0]) {
						setError('email', { message: t(`validation.${details[0].code}`, details[0].params) }, { shouldFocus: true })
						return
					}
					if (code === ERROR_CODE.EMAIL_TAKEN) {
						setError('email', { message: t('errors.EMAIL_TAKEN') }, { shouldFocus: true })
						return
					}
					notifications.show({ color: 'red', message: t(`errors.${code}`) })
				},
			},
		)
	})

	return (
		<AppModal
			opened={opened}
			onClose={handleClose}
			title={t('userPage.emailModal.title')}
			description={t('userPage.emailModal.description')}
			closeLabel={t('userPage.emailModal.close')}
			isPending={isPending}
			size={480}
			onSubmit={(event) => void onSubmit(event)}
			footer={
				<>
					<Button variant='default' onClick={handleClose} disabled={isPending}>
						{t('userPage.emailModal.cancel')}
					</Button>
					<Button type='submit' loading={isPending}>
						{t('userPage.emailModal.submit')}
					</Button>
				</>
			}
		>
			<TextInput
				type='email'
				autoComplete='off'
				data-autofocus
				label={t('userPage.emailModal.label')}
				error={errors.email?.message}
				{...register('email')}
			/>
		</AppModal>
	)
}

export default EditUserEmailModal
