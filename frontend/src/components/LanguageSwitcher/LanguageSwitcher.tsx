import { SegmentedControl } from '@mantine/core'
import { useTranslation } from 'react-i18next'

import { DEFAULT_LANGUAGE } from '@/lib/constants'
import { LANGUAGE } from '@/lib/enum'

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
			data={Object.values(LANGUAGE).map((language) => ({ value: language, label: t(`topBar.languages.${language}`) }))}
		/>
	)
}

export default LanguageSwitcher
