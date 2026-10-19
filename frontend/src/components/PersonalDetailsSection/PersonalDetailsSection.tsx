import { Select, TextInput } from '@mantine/core'
import { Controller } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { ROLE } from '@locale/shared'

import { ChevronDown } from '@/components/Icons'
import ProfileSection from '@/components/ProfileSection/ProfileSection'

import { type PersonalDetailsSectionProps } from './types'

/** "Osobné údaje" (Figma 3:1825). The names are editable, the email is shown disabled and the global role is a select an ADMIN may change. */
const PersonalDetailsSection = ({ register, errors, control, email, canChangeRole }: PersonalDetailsSectionProps) => {
	const { t } = useTranslation()

	return (
		<ProfileSection title={t('profilePage.personal.title')} description={t('profilePage.personal.description')}>
			<div className='grid grid-cols-1 gap-5 sm:grid-cols-2'>
				<TextInput autoComplete='given-name' label={t('profilePage.personal.firstName')} error={errors.firstName?.message} {...register('firstName')} />
				<TextInput autoComplete='family-name' label={t('profilePage.personal.lastName')} error={errors.lastName?.message} {...register('lastName')} />
				<TextInput type='email' label={t('profilePage.personal.email')} defaultValue={email} disabled />
				<Controller
					control={control}
					name='role'
					render={({ field: { value, onChange, onBlur, ref } }) => (
						<Select
							ref={ref}
							label={t('profilePage.personal.role')}
							value={value ?? null}
							onChange={(role) => role && onChange(role)}
							onBlur={onBlur}
							disabled={!canChangeRole}
							allowDeselect={false}
							rightSection={<ChevronDown aria-hidden />}
							rightSectionPointerEvents='none'
							data={Object.values(ROLE).map((role) => ({ value: role, label: t(`roles.${role}`) }))}
						/>
					)}
				/>
			</div>
		</ProfileSection>
	)
}

export default PersonalDetailsSection
