import { Select, Switch } from '@mantine/core'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import { ChevronDown } from '@/components/Icons'
import ProfileSection from '@/components/ProfileSection/ProfileSection'
import { DEFAULT_LANGUAGE } from '@/lib/constants'
import { LANGUAGE } from '@/lib/enum'

import classes from './PreferencesSection.module.css'

const NOTIFICATIONS = ['mentions', 'review', 'importsExports'] as const

/**
 * "Preferencie" (Figma 3:1859). The language applies immediately like the top-bar `LanguageSwitcher`, not through "Uložiť profil".
 * Email notifications are not in the MVP, so the switches are disabled and off.
 */
const PreferencesSection = () => {
	const { t, i18n } = useTranslation()
	const languageId = useId()
	const notificationsId = useId()

	return (
		<ProfileSection title={t('profilePage.preferences.title')} description={t('profilePage.preferences.description')}>
			<div className={`${classes.grid} grid gap-6`}>
				<label htmlFor={languageId} className={`${classes.label} pt-3`}>
					{t('profilePage.preferences.language')}
				</label>
				<Select
					id={languageId}
					className={classes.select}
					value={i18n.resolvedLanguage ?? DEFAULT_LANGUAGE}
					onChange={(language) => language && void i18n.changeLanguage(language)}
					allowDeselect={false}
					rightSection={<ChevronDown aria-hidden />}
					rightSectionPointerEvents='none'
					data={Object.values(LANGUAGE).map((language) => ({ value: language, label: t(`topBar.languages.${language}.name`) }))}
				/>
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
