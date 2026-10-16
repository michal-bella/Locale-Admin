import { SegmentedControl, VisuallyHidden } from '@mantine/core'
import { GB, SK } from 'country-flag-icons/react/3x2'
import { useTranslation } from 'react-i18next'

import { DEFAULT_LANGUAGE } from '@/lib/constants'
import { LANGUAGE } from '@/lib/enum'

import classes from './LanguageSwitcher.module.css'

/** `en` uses British formats (`en-GB` dates), hence the UK flag. */
const LANGUAGE_FLAG = {
	[LANGUAGE.SK]: SK,
	[LANGUAGE.EN]: GB,
} as const satisfies Record<LANGUAGE, unknown>

/** Switches the UI language without a reload; `lib/i18n` stores the choice in localStorage. */
const LanguageSwitcher = () => {
	const { t, i18n } = useTranslation()

	return (
		<SegmentedControl
			size='xs'
			radius='md'
			aria-label={t('topBar.language')}
			value={i18n.resolvedLanguage ?? DEFAULT_LANGUAGE}
			onChange={(language) => void i18n.changeLanguage(language)}
			// SegmentedControl has no per-item aria-label: the visible code is hidden from screen readers, the full language name is announced instead.
			data={Object.values(LANGUAGE).map((language) => {
				const Flag = LANGUAGE_FLAG[language]
				return {
					value: language,
					label: (
						<span className='inline-flex items-center gap-1.5'>
							<Flag aria-hidden='true' className={classes.flag} />
							<span aria-hidden='true'>{t(`topBar.languages.${language}.label`)}</span>
							<VisuallyHidden lang={language}>{t(`topBar.languages.${language}.name`)}</VisuallyHidden>
						</span>
					),
				}
			})}
		/>
	)
}

export default LanguageSwitcher
