import { Switch, TextInput } from '@mantine/core'
import { Controller } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { ROLE } from '@locale/shared'

import ProfileSection from '@/components/ProfileSection/ProfileSection'

import { type PersonalDetailsSectionProps } from './types'

/** "Osobné údaje" (Figma 3:1825). The names are editable, the email is shown disabled; an ADMIN also gets the Administrátor switch to give up the role. */
const PersonalDetailsSection = ({ register, errors, control, email, canChangeRole }: PersonalDetailsSectionProps) => {
	const { t } = useTranslation()

	return (
		<ProfileSection title={t('profilePage.personal.title')} description={t('profilePage.personal.description')}>
			<div className='grid grid-cols-1 gap-5 sm:grid-cols-2'>
				<TextInput autoComplete='given-name' label={t('profilePage.personal.firstName')} error={errors.firstName?.message} {...register('firstName')} />
				<TextInput autoComplete='family-name' label={t('profilePage.personal.lastName')} error={errors.lastName?.message} {...register('lastName')} />
				<TextInput type='email' label={t('profilePage.personal.email')} defaultValue={email} disabled />
				{canChangeRole && (
					<Controller
						control={control}
						name='role'
						render={({ field: { value, onChange, onBlur, ref } }) => (
							<Switch
								ref={ref}
								className='sm:col-span-2'
								label={t('adminAccess.label')}
								description={t('adminAccess.description')}
								checked={value === ROLE.ADMIN}
								onChange={(event) => onChange(event.currentTarget.checked ? ROLE.ADMIN : ROLE.USER)}
								onBlur={onBlur}
								withThumbIndicator={false}
							/>
						)}
					/>
				)}
			</div>
		</ProfileSection>
	)
}

export default PersonalDetailsSection
