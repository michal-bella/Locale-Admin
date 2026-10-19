import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Input, Modal, SegmentedControl, Text, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useId } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { type CreateUserRequest, createUserRequestSchema, ERROR_CODE, PASSWORD_MIN_LENGTH, ROLE, toValidationCode } from '@locale/shared'

import { useCreateUserMutation } from '@/api/adminUsers/useCreateUserMutation'
import getApiErrorCode from '@/api/getApiErrorCode'
import getApiErrorDetails from '@/api/getApiErrorDetails'
import { Close } from '@/components/Icons'

import classes from './CreateUserModal.module.css'
import { type CreateUserModalProps } from './types'

/** "Nový používateľ" modal (Figma 28:191) with the global role (Admin / Editor). Members of projects are added from these users. */
const CreateUserModal = ({ opened, onClose, defaultRole = ROLE.EDITOR, onCreated }: CreateUserModalProps) => {
	const { t } = useTranslation()
	const roleId = useId()
	const createUser = useCreateUserMutation()
	const { isPending } = createUser
	const {
		register,
		control,
		handleSubmit,
		setError,
		reset,
		formState: { errors },
	} = useForm({
		resolver: zodResolver(createUserRequestSchema, {
			error: (issue) => {
				// zod passes a raw issue here; the fields toValidationCode reads (code, input, minimum, maximum, format) match the final issue.
				const { code, params } = toValidationCode(issue as Parameters<typeof toValidationCode>[0])
				return t(`validation.${code}`, params)
			},
		}),
		defaultValues: { email: '', password: '', role: defaultRole },
	})
	const role = useWatch({ control, name: 'role' })

	const resetAndClose = () => {
		reset()
		createUser.reset()
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
		createUser.mutate(values, {
			onSuccess: (user) => {
				notifications.show({ color: 'green', message: t('usersPage.createModal.success', { email: user.email }) })
				resetAndClose()
				onCreated?.(user)
			},
			onError: (error) => {
				const code = getApiErrorCode(error)
				const details = getApiErrorDetails(error)
				if (code === ERROR_CODE.VALIDATION_ERROR && details.length > 0) {
					details.forEach(({ path, code: issueCode, params }, index) =>
						setError(path as keyof CreateUserRequest, { message: t(`validation.${issueCode}`, params) }, { shouldFocus: index === 0 }),
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
		<Modal.Root
			opened={opened}
			onClose={handleClose}
			closeOnEscape={!isPending}
			closeOnClickOutside={!isPending}
			centered
			size={560}
			radius='xl'
			shadow='modal'
		>
			<Modal.Overlay color='var(--mantine-color-black)' backgroundOpacity={0.25} blur={2} />
			<Modal.Content className={classes.content}>
				<Modal.Header className={classes.header}>
					<div className='flex flex-col gap-1'>
						<Modal.Title className={classes.title}>{t('usersPage.createModal.title')}</Modal.Title>
						<Text size='sm'>{t('usersPage.createModal.description')}</Text>
					</div>
					<Modal.CloseButton
						aria-label={t('usersPage.createModal.close')}
						icon={<Close aria-hidden />}
						disabled={isPending}
						className={classes.close}
					/>
				</Modal.Header>
				<Modal.Body className={classes.body}>
					<form onSubmit={(event) => void onSubmit(event)} noValidate>
						<div className={`${classes.fields} flex flex-col gap-4`}>
							<TextInput
								type='email'
								autoComplete='off'
								data-autofocus
								label={t('usersPage.createModal.email.label')}
								placeholder={t('usersPage.createModal.email.placeholder')}
								error={errors.email?.message}
								{...register('email')}
							/>
							<TextInput
								type='password'
								autoComplete='new-password'
								label={t('usersPage.createModal.password.label')}
								placeholder={t('usersPage.createModal.password.placeholder', { min: PASSWORD_MIN_LENGTH })}
								error={errors.password?.message}
								{...register('password')}
							/>
							<Input.Wrapper
								id={roleId}
								labelElement='div'
								label={t('usersPage.createModal.role.label')}
								description={t(`usersPage.createModal.role.description.${role}`)}
								inputWrapperOrder={['label', 'input', 'description']}
							>
								<Controller
									name='role'
									control={control}
									render={({ field }) => (
										<SegmentedControl
											aria-labelledby={`${roleId}-label`}
											aria-describedby={`${roleId}-description`}
											fullWidth
											disabled={isPending}
											value={field.value}
											onChange={field.onChange}
											data={[
												{ value: ROLE.ADMIN, label: t('roles.ADMIN') },
												{ value: ROLE.EDITOR, label: t('roles.EDITOR') },
											]}
										/>
									)}
								/>
							</Input.Wrapper>
						</div>
						<div className={`${classes.footer} flex justify-end gap-2`}>
							<Button variant='default' onClick={handleClose} disabled={isPending}>
								{t('usersPage.createModal.cancel')}
							</Button>
							<Button type='submit' loading={isPending}>
								{t('usersPage.createModal.submit')}
							</Button>
						</div>
					</form>
				</Modal.Body>
			</Modal.Content>
		</Modal.Root>
	)
}

export default CreateUserModal
