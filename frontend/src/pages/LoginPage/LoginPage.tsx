import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, TextInput } from '@mantine/core'
import { isAxiosError } from 'axios'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { ERROR_CODE, type LoginRequest, loginRequestSchema, toValidationCode } from '@locale/shared'

import { useLoginMutation } from '@/api/auth/useLoginMutation'
import getApiErrorCode from '@/api/getApiErrorCode'
import getApiErrorDetails from '@/api/getApiErrorDetails'
import CenteredLayout from '@/components/CenteredLayout/CenteredLayout'
import { ArrowRight } from '@/components/Icons'
import PageIntro from '@/components/PageIntro/PageIntro'

type FormError = { code: ReturnType<typeof getApiErrorCode>; retryAfterSeconds?: number }

const getRetryAfterSeconds = (error: unknown) => {
	const seconds = Number(isAxiosError(error) ? error.response?.headers['retry-after'] : undefined)
	return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined
}

const LoginPage = () => {
	const { t } = useTranslation()
	const login = useLoginMutation()
	const [formError, setFormError] = useState<FormError | null>(null)
	const {
		register,
		handleSubmit,
		setError,
		formState: { errors },
	} = useForm({
		resolver: zodResolver(loginRequestSchema, {
			error: (issue) => {
				// zod passes a raw issue here; the fields toValidationCode reads (code, input, minimum, maximum, format) match the final issue.
				const { code, params } = toValidationCode(issue as Parameters<typeof toValidationCode>[0])
				return t(`validation.${code}`, params)
			},
		}),
		defaultValues: { email: '', password: '' },
	})

	const onSubmit = handleSubmit((values) => {
		setFormError(null)
		login.mutate(values, {
			onError: (error) => {
				const code = getApiErrorCode(error)
				const details = getApiErrorDetails(error)
				if (code === ERROR_CODE.VALIDATION_ERROR && details.length > 0) {
					details.forEach(({ path, code: issueCode, params }) =>
						setError(path as keyof LoginRequest, { message: t(`validation.${issueCode}`, params) }),
					)
					return
				}
				setFormError({ code, retryAfterSeconds: code === ERROR_CODE.RATE_LIMITED ? getRetryAfterSeconds(error) : undefined })
			},
		})
	})

	return (
		<CenteredLayout>
			<PageIntro eyebrow={t('loginPage.eyebrow')} title={t('loginPage.title')} description={t('loginPage.description')} />
			<form className='mt-8 flex flex-col gap-4' onSubmit={(event) => void onSubmit(event)} noValidate>
				<TextInput
					type='email'
					autoComplete='username'
					label={t('loginPage.form.email.label')}
					placeholder={t('loginPage.form.email.placeholder')}
					error={errors.email?.message}
					{...register('email')}
				/>
				<TextInput
					type='password'
					autoComplete='current-password'
					label={t('loginPage.form.password.label')}
					placeholder={t('loginPage.form.password.placeholder')}
					error={errors.password?.message}
					{...register('password')}
				/>
				{formError && (
					<Alert color='red' variant='light' radius='lg'>
						{formError.retryAfterSeconds
							? t('loginPage.form.rateLimited', { seconds: formError.retryAfterSeconds })
							: t(`errors.${formError.code}`)}
					</Alert>
				)}
				<Button type='submit' fullWidth className='mt-2' loading={login.isPending} rightSection={<ArrowRight aria-hidden />}>
					{t('loginPage.form.submit')}
				</Button>
			</form>
		</CenteredLayout>
	)
}

export default LoginPage
