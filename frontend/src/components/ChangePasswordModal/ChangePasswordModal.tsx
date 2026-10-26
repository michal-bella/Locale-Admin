import { zodResolver } from '@hookform/resolvers/zod'
import { Button, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { type ChangePasswordRequest, changePasswordRequestSchema, ERROR_CODE, PASSWORD_MIN_LENGTH, toValidationCode } from '@locale/shared'

import getApiErrorCode from '@/api/getApiErrorCode'
import getApiErrorDetails from '@/api/getApiErrorDetails'
import { useChangePasswordMutation } from '@/api/profile/useChangePasswordMutation'
import AppModal from '@/components/AppModal/AppModal'

import { type ChangePasswordModalProps } from './types'

// The confirmation exists only in the form; the request carries the two fields of the contract.
const formSchema = changePasswordRequestSchema
	.extend({ newPasswordConfirm: z.string() })
	.refine(({ newPassword, newPasswordConfirm }) => newPassword === newPasswordConfirm, { path: ['newPasswordConfirm'] })

type FormValues = z.infer<typeof formSchema>

const EMPTY_VALUES: FormValues = { currentPassword: '', newPassword: '', newPasswordConfirm: '' }

/** "Zmeniť heslo" from the profile: current password, new password and its confirmation. This session stays signed in, the other ones end. */
const ChangePasswordModal = ({ opened, onClose }: ChangePasswordModalProps) => {
	const { t } = useTranslation()
	const changePassword = useChangePasswordMutation()
	const { isPending } = changePassword
	const {
		register,
		handleSubmit,
		setError,
		reset,
		formState: { errors },
	} = useForm({
		resolver: zodResolver(formSchema, {
			error: (issue) => {
				if (issue.code === 'custom' && issue.path?.[0] === 'newPasswordConfirm') {
					return t('profilePage.security.modal.newPasswordConfirm.mismatch')
				}
				// zod passes a raw issue here; the fields toValidationCode reads (code, input, minimum, maximum, format) match the final issue.
				const { code, params } = toValidationCode(issue as Parameters<typeof toValidationCode>[0])
				return t(`validation.${code}`, params)
			},
		}),
		defaultValues: EMPTY_VALUES,
	})

	const resetAndClose = () => {
		reset(EMPTY_VALUES)
		changePassword.reset()
		onClose()
	}

	const handleClose = () => {
		if (!isPending) {
			resetAndClose()
		}
	}

	const onSubmit = handleSubmit(({ currentPassword, newPassword }) => {
		if (isPending) {
			return
		}
		changePassword.mutate(
			{ currentPassword, newPassword },
			{
				onSuccess: () => {
					notifications.show({ color: 'green', message: t('profilePage.security.modal.success') })
					resetAndClose()
				},
				onError: (error) => {
					const code = getApiErrorCode(error)
					const details = getApiErrorDetails(error)
					if (code === ERROR_CODE.VALIDATION_ERROR && details.length > 0) {
						details.forEach(({ path, code: issueCode, params }, index) =>
							setError(path as keyof ChangePasswordRequest, { message: t(`validation.${issueCode}`, params) }, { shouldFocus: index === 0 }),
						)
						return
					}
					if (code === ERROR_CODE.PASSWORD_INCORRECT) {
						setError('currentPassword', { message: t('errors.PASSWORD_INCORRECT') }, { shouldFocus: true })
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
			title={t('profilePage.security.modal.title')}
			description={t('profilePage.security.modal.description')}
			closeLabel={t('profilePage.security.modal.close')}
			isPending={isPending}
			onSubmit={(event) => void onSubmit(event)}
			footer={
				<>
					<Button variant='default' onClick={handleClose} disabled={isPending}>
						{t('profilePage.security.modal.cancel')}
					</Button>
					<Button type='submit' loading={isPending}>
						{t('profilePage.security.modal.submit')}
					</Button>
				</>
			}
		>
			<div className='flex flex-col gap-4'>
				<TextInput
					type='password'
					autoComplete='current-password'
					data-autofocus
					label={t('profilePage.security.modal.currentPassword.label')}
					placeholder={t('profilePage.security.modal.currentPassword.placeholder')}
					error={errors.currentPassword?.message}
					{...register('currentPassword')}
				/>
				<TextInput
					type='password'
					autoComplete='new-password'
					label={t('profilePage.security.modal.newPassword.label')}
					placeholder={t('profilePage.security.modal.newPassword.placeholder', { min: PASSWORD_MIN_LENGTH })}
					error={errors.newPassword?.message}
					{...register('newPassword')}
				/>
				<TextInput
					type='password'
					autoComplete='new-password'
					label={t('profilePage.security.modal.newPasswordConfirm.label')}
					placeholder={t('profilePage.security.modal.newPasswordConfirm.placeholder')}
					error={errors.newPasswordConfirm?.message}
					{...register('newPasswordConfirm')}
				/>
			</div>
		</AppModal>
	)
}

export default ChangePasswordModal
