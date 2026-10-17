import { TextInput } from '@mantine/core'
import { useTranslation } from 'react-i18next'

import ProfileSection from '@/components/ProfileSection/ProfileSection'

import { type PersonalDetailsSectionProps } from './types'

/** "Osobné údaje" (Figma 3:1825). Only the names are editable; email and job title are shown disabled. */
const PersonalDetailsSection = ({ register, errors, email }: PersonalDetailsSectionProps) => {
	const { t } = useTranslation()

	return (
		<ProfileSection title={t('profilePage.personal.title')} description={t('profilePage.personal.description')}>
			<div className='grid grid-cols-1 gap-5 sm:grid-cols-2'>
				<TextInput autoComplete='given-name' label={t('profilePage.personal.firstName')} error={errors.firstName?.message} {...register('firstName')} />
				<TextInput autoComplete='family-name' label={t('profilePage.personal.lastName')} error={errors.lastName?.message} {...register('lastName')} />
				<TextInput type='email' label={t('profilePage.personal.email')} defaultValue={email} disabled />
				<TextInput label={t('profilePage.personal.position.label')} placeholder={t('profilePage.personal.position.placeholder')} disabled />
			</div>
		</ProfileSection>
	)
}

export default PersonalDetailsSection
