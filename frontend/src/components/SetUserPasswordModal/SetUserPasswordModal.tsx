import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Text, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { ERROR_CODE, PASSWORD_MIN_LENGTH, setUserPasswordRequestSchema, toValidationCode } from '@locale/shared'

import { useSetUserPasswordMutation } from '@/api/adminUsers/useSetUserPasswordMutation'
import getApiErrorCode from '@/api/getApiErrorCode'
import getApiErrorDetails from '@/api/getApiErrorDetails'
import AppModal from '@/components/AppModal/AppModal'

import { type SetUserPasswordModalProps } from './types'

// The confirmation exists only in the form; the request carries the password of the contract.
const formSchema = setUserPasswordRequestSchema
	.extend({ passwordConfirm: z.string() })
	.refine(({ password, passwordConfirm }) => password === passwordConfirm, { path: ['passwordConfirm'] })

type FormValues = z.infer<typeof formSchema>

const EMPTY_VALUES: FormValues = { password: '', passwordConfirm: '' }

/**
 * "Nastaviť heslo" on the user detail: the new password and its confirmation. The user is signed out everywhere; a user who signs in only
 * with Google can sign in with the password too afterwards.
 */
const SetUserPasswordModal = ({ user, opened, onClose }: SetUserPasswordModalProps) => {
	const { t } = useTranslation()
	const setPassword = useSetUserPasswordMutation(user.id)
	const { isPending } = setPassword
	const {
		register,
		handleSubmit,
		setError,
		reset,
		formState: { errors },
	} = useForm({
		resolver: zodResolver(formSchema, {
			error: (issue) => {
				if (issue.code === 'custom' && issue.path?.[0] === 'passwordConfirm') {
					return t('userPage.passwordModal.passwordConfirm.mismatch')
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
		setPassword.reset()
		onClose()
	}

	const handleClose = () => {
		if (!isPending) {
			resetAndClose()
		}
	}

	const onSubmit = handleSubmit(({ password }) => {
		if (isPending) {
			return
		}
		setPassword.mutate(
			{ password },
			{
				onSuccess: () => {
					notifications.show({ color: 'green', message: t('userPage.passwordModal.success', { email: user.email }) })
					resetAndClose()
				},
				onError: (error) => {
					const code = getApiErrorCode(error)
					const details = getApiErrorDetails(error)
					if (code === ERROR_CODE.VALIDATION_ERROR && details[0]) {
						setError('password', { message: t(`validation.${details[0].code}`, details[0].params) }, { shouldFocus: true })
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
			title={t('userPage.passwordModal.title')}
			description={t('userPage.passwordModal.description', { email: user.email })}
			closeLabel={t('userPage.passwordModal.close')}
			isPending={isPending}
			size={480}
			onSubmit={(event) => void onSubmit(event)}
			footer={
				<>
					<Button variant='default' onClick={handleClose} disabled={isPending}>
						{t('userPage.passwordModal.cancel')}
					</Button>
					<Button type='submit' loading={isPending}>
						{t('userPage.passwordModal.submit')}
					</Button>
				</>
			}
		>
			<div className='flex flex-col gap-4'>
				{!user.hasPassword && <Text size='sm'>{t('userPage.passwordModal.googleOnly')}</Text>}
				<TextInput
					type='password'
					autoComplete='new-password'
					data-autofocus
					label={t('userPage.passwordModal.password.label')}
					placeholder={t('userPage.passwordModal.password.placeholder', { min: PASSWORD_MIN_LENGTH })}
					error={errors.password?.message}
					{...register('password')}
				/>
				<TextInput
					type='password'
					autoComplete='new-password'
					label={t('userPage.passwordModal.passwordConfirm.label')}
					placeholder={t('userPage.passwordModal.passwordConfirm.placeholder')}
					error={errors.passwordConfirm?.message}
					{...register('passwordConfirm')}
				/>
			</div>
		</AppModal>
	)
}

export default SetUserPasswordModal
