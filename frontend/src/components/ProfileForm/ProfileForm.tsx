import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { ERROR_CODE, type Profile, toValidationCode, type UpdateProfileRequest, updateProfileRequestSchema } from '@locale/shared'

import getApiErrorCode from '@/api/getApiErrorCode'
import getApiErrorDetails from '@/api/getApiErrorDetails'
import { useUpdateProfileMutation } from '@/api/profile/useUpdateProfileMutation'
import PersonalDetailsSection from '@/components/PersonalDetailsSection/PersonalDetailsSection'
import PreferencesSection from '@/components/PreferencesSection/PreferencesSection'
import ProfileCard from '@/components/ProfileCard/ProfileCard'
import SecuritySection from '@/components/SecuritySection/SecuritySection'

import { type ProfileFormProps } from './types'

const toFormValues = ({ firstName, lastName }: Profile): UpdateProfileRequest => ({ firstName: firstName ?? '', lastName: lastName ?? '' })

/** Profile page body (Figma 3:1762). "Uložiť profil" saves only the first and last name. */
const ProfileForm = ({ profile }: ProfileFormProps) => {
	const { t } = useTranslation()
	const updateProfile = useUpdateProfileMutation()
	const { isPending } = updateProfile
	const {
		register,
		handleSubmit,
		setError,
		reset,
		formState: { errors, isDirty },
	} = useForm({
		resolver: zodResolver(updateProfileRequestSchema, {
			error: (issue) => {
				// zod passes a raw issue here; the fields toValidationCode reads (code, input, minimum, maximum, format) match the final issue.
				const { code, params } = toValidationCode(issue as Parameters<typeof toValidationCode>[0])
				return t(`validation.${code}`, params)
			},
		}),
		defaultValues: toFormValues(profile),
	})

	const onSubmit = handleSubmit((values) => {
		if (isPending) {
			return
		}
		updateProfile.mutate(values, {
			onSuccess: (saved) => {
				notifications.show({ color: 'green', message: t('profilePage.saveSuccess') })
				reset(toFormValues(saved))
			},
			onError: (error) => {
				const code = getApiErrorCode(error)
				const details = getApiErrorDetails(error)
				if (code === ERROR_CODE.VALIDATION_ERROR && details.length > 0) {
					details.forEach(({ path, code: issueCode, params }, index) =>
						setError(path as keyof UpdateProfileRequest, { message: t(`validation.${issueCode}`, params) }, { shouldFocus: index === 0 }),
					)
					return
				}
				notifications.show({ color: 'red', message: t(`errors.${code}`) })
			},
		})
	})

	return (
		<form onSubmit={(event) => void onSubmit(event)} noValidate className='flex flex-col gap-5'>
			<ProfileCard profile={profile} />
			<PersonalDetailsSection register={register} errors={errors} email={profile.email} />
			<PreferencesSection />
			<SecuritySection passwordChangedAt={profile.passwordChangedAt} />
			<div className='flex justify-end'>
				<Button type='submit' loading={isPending} disabled={!isDirty}>
					{t('profilePage.save')}
				</Button>
			</div>
		</form>
	)
}

export default ProfileForm
