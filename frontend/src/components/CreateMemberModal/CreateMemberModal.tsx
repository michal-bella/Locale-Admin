import { zodResolver } from '@hookform/resolvers/zod'
import { Button, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { type CreateProjectMemberRequest, createProjectMemberRequestSchema, ERROR_CODE, PASSWORD_MIN_LENGTH, toValidationCode } from '@locale/shared'

import getApiErrorCode from '@/api/getApiErrorCode'
import getApiErrorDetails from '@/api/getApiErrorDetails'
import { useCreateProjectMemberMutation } from '@/api/projectMembers/useCreateProjectMemberMutation'
import AppModal from '@/components/AppModal/AppModal'

import { type CreateMemberModalProps } from './types'

/** "Nový člen": creates a new user who is a member of this project. */
const CreateMemberModal = ({ projectId, opened, onClose }: CreateMemberModalProps) => {
	const { t } = useTranslation()
	const createMember = useCreateProjectMemberMutation(projectId)
	const { isPending } = createMember
	const {
		register,
		handleSubmit,
		setError,
		reset,
		formState: { errors },
	} = useForm({
		resolver: zodResolver(createProjectMemberRequestSchema, {
			error: (issue) => {
				// zod passes a raw issue here; the fields toValidationCode reads (code, input, minimum, maximum, format) match the final issue.
				const { code, params } = toValidationCode(issue as Parameters<typeof toValidationCode>[0])
				return t(`validation.${code}`, params)
			},
		}),
		defaultValues: { email: '', password: '' },
	})

	const resetAndClose = () => {
		reset()
		createMember.reset()
		onClose()
	}

	const handleClose = () => {
		if (!isPending) {
			resetAndClose()
		}
	}

	const onSubmit = handleSubmit((values) => {
		if (isPending) {
			return
		}
		createMember.mutate(values, {
			onSuccess: (member) => {
				notifications.show({ color: 'green', message: t('membersPage.createModal.success', { email: member.email }) })
				resetAndClose()
			},
			onError: (error) => {
				const code = getApiErrorCode(error)
				const details = getApiErrorDetails(error)
				if (code === ERROR_CODE.VALIDATION_ERROR && details.length > 0) {
					details.forEach(({ path, code: issueCode, params }, index) =>
						setError(path as keyof CreateProjectMemberRequest, { message: t(`validation.${issueCode}`, params) }, { shouldFocus: index === 0 }),
					)
					return
				}
				if (code === ERROR_CODE.EMAIL_TAKEN) {
					setError('email', { message: t('errors.EMAIL_TAKEN') }, { shouldFocus: true })
					return
				}
				notifications.show({ color: 'red', message: t(`errors.${code}`) })
			},
		})
	})

	return (
		<AppModal
			opened={opened}
			onClose={handleClose}
			title={t('membersPage.createModal.title')}
			description={t('membersPage.createModal.description')}
			closeLabel={t('membersPage.createModal.close')}
			isPending={isPending}
			onSubmit={(event) => void onSubmit(event)}
			footer={
				<>
					<Button variant='default' onClick={handleClose} disabled={isPending}>
						{t('membersPage.createModal.cancel')}
					</Button>
					<Button type='submit' loading={isPending}>
						{t('membersPage.createModal.submit')}
					</Button>
				</>
			}
		>
			<TextInput
				type='email'
				autoComplete='off'
				data-autofocus
				label={t('membersPage.createModal.email.label')}
				placeholder={t('membersPage.createModal.email.placeholder')}
				error={errors.email?.message}
				{...register('email')}
			/>
			<TextInput
				type='password'
				autoComplete='new-password'
				label={t('membersPage.createModal.password.label')}
				placeholder={t('membersPage.createModal.password.placeholder', { min: PASSWORD_MIN_LENGTH })}
				error={errors.password?.message}
				{...register('password')}
			/>
		</AppModal>
	)
}

export default CreateMemberModal
