import { SegmentedControl, VisuallyHidden } from '@mantine/core'
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
			// SegmentedControl has no per-item aria-label: the visible code is hidden from screen readers, the full language name is announced instead.
			data={Object.values(LANGUAGE).map((language) => ({
				value: language,
				label: (
					<>
						<span aria-hidden='true'>{t(`topBar.languages.${language}.label`)}</span>
						<VisuallyHidden lang={language}>{t(`topBar.languages.${language}.name`)}</VisuallyHidden>
					</>
				),
			}))}
		/>
	)
}

export default LanguageSwitcher
