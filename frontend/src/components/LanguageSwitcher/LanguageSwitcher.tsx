import { rem, Select } from '@mantine/core'
import { CZ, GB, SK } from 'country-flag-icons/react/3x2'
import { useTranslation } from 'react-i18next'

import { ChevronDown } from '@/components/Icons'
import { DEFAULT_LANGUAGE } from '@/lib/constants'
import { LANGUAGE } from '@/lib/enum'
import { isLanguage } from '@/lib/utils'

import classes from './LanguageSwitcher.module.css'

/** `en` uses British formats (`en-GB` dates), hence the UK flag. */
const LANGUAGE_FLAG = {
	[LANGUAGE.SK]: SK,
	[LANGUAGE.CS]: CZ,
	[LANGUAGE.EN]: GB,
} as const satisfies Record<LANGUAGE, unknown>

/** Switches the UI language without a reload; `lib/i18n` stores the choice in localStorage. */
const LanguageSwitcher = () => {
	const { t, i18n } = useTranslation()
	const language = isLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : DEFAULT_LANGUAGE
	const Flag = LANGUAGE_FLAG[language]

	return (
		<Select
			className={classes.root}
			// The theme's 44 px form inputs are too tall for the top bar; 38 px matches the theme switcher.
			styles={{ wrapper: { '--input-height': rem(38), '--input-radius': 'var(--mantine-radius-md)' } }}
			aria-label={t('topBar.language')}
			value={language}
			onChange={(value) => value && void i18n.changeLanguage(value)}
			allowDeselect={false}
			// Three options need no scroll area; with it, the first render of every page in jsdom took about 0.5 s longer.
			withScrollArea={false}
			leftSection={<Flag aria-hidden='true' className={classes.flag} />}
			rightSection={<ChevronDown aria-hidden />}
			rightSectionPointerEvents='none'
			data={Object.values(LANGUAGE).map((value) => ({ value, label: t(`topBar.languages.${value}.name`) }))}
			renderOption={({ option }) => {
				const OptionFlag = LANGUAGE_FLAG[option.value]
				return (
					<span className='inline-flex items-center gap-2'>
						<OptionFlag aria-hidden='true' className={classes.flag} />
						<span lang={option.value}>{option.label}</span>
					</span>
				)
			}}
		/>
	)
}

export default LanguageSwitcher
