import { Switch } from '@mantine/core'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import LanguageSwitcher from '@/components/LanguageSwitcher/LanguageSwitcher'
import ProfileSection from '@/components/ProfileSection/ProfileSection'

import classes from './PreferencesSection.module.css'

const NOTIFICATIONS = ['mentions', 'review', 'importsExports'] as const

/**
 * "Preferencie" (Figma 3:1859). The language is the top-bar `LanguageSwitcher` in its form variant, so it applies immediately, not through "Uložiť profil".
 * Email notifications are not in the MVP, so the switches are disabled and off.
 */
const PreferencesSection = () => {
	const { t } = useTranslation()
	const languageId = useId()
	const notificationsId = useId()

	return (
		<ProfileSection title={t('profilePage.preferences.title')} description={t('profilePage.preferences.description')}>
			<div className={`${classes.grid} grid gap-6`}>
				<label htmlFor={languageId} className={`${classes.label} pt-3`}>
					{t('profilePage.preferences.language')}
				</label>
				<LanguageSwitcher variant='form' id={languageId} className={classes.select} />
				<span id={notificationsId} className={`${classes.label} pt-1`}>
					{t('profilePage.preferences.notifications.title')}
				</span>
				<div role='group' aria-labelledby={notificationsId} className={`${classes.switches} flex flex-col gap-4`}>
					{NOTIFICATIONS.map((notification) => (
						<Switch
							key={notification}
							labelPosition='left'
							label={t(`profilePage.preferences.notifications.${notification}.label`)}
							description={t(`profilePage.preferences.notifications.${notification}.description`)}
							withThumbIndicator={false}
							disabled
							classNames={{ body: classes.switchBody, label: classes.switchLabel, description: classes.switchDescription }}
						/>
					))}
				</div>
			</div>
		</ProfileSection>
	)
}

export default PreferencesSection
