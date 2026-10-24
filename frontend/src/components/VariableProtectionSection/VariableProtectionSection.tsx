import { Switch } from '@mantine/core'
import { Controller } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import ProfileSection from '@/components/ProfileSection/ProfileSection'

import classes from './VariableProtectionSection.module.css'
import { type VariableProtectionSectionProps } from './types'

// Passed as a parameter: written into the translation, i18next would treat it as its own placeholder.
const VARIABLE_EXAMPLE = '{{ variable }}'

/** "Kontrola premenných" (Figma 3:1631 „Ochrana dynamických segmentov“): `protectVariables` makes the API refuse saving a translation whose variables differ from the base language. */
const VariableProtectionSection = ({ control, disabled = false }: VariableProtectionSectionProps) => {
	const { t } = useTranslation()

	return (
		<ProfileSection title={t('projectSettingsPage.variables.title')} description={t('projectSettingsPage.variables.description')} withDivider={false}>
			<div className={classes.box}>
				<Controller
					control={control}
					name='protectVariables'
					render={({ field }) => (
						<Switch
							ref={field.ref}
							size='md'
							labelPosition='left'
							label={t('projectSettingsPage.variables.protect.label')}
							description={t('projectSettingsPage.variables.protect.description', { example: VARIABLE_EXAMPLE })}
							checked={field.value}
							disabled={disabled}
							onChange={(event) => field.onChange(event.currentTarget.checked)}
							onBlur={field.onBlur}
							withThumbIndicator={false}
							classNames={{ body: classes.switchBody, label: classes.switchLabel, description: classes.switchDescription }}
						/>
					)}
				/>
			</div>
		</ProfileSection>
	)
}

export default VariableProtectionSection
