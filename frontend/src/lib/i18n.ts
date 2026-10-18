import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import { DEFAULT_LANGUAGE, LOCALE_STORAGE_KEY } from '@/lib/constants'
import { LANGUAGE } from '@/lib/enum'
import { isLanguage } from '@/lib/utils'
import cs from '@/locales/cs.json'
import en from '@/locales/en.json'
import sk from '@/locales/sk.json'

export const resources = {
	[LANGUAGE.SK]: { translation: sk },
	[LANGUAGE.EN]: { translation: en },
	[LANGUAGE.CS]: { translation: cs },
} as const

// localStorage throws in some private modes and when storage is blocked.
const readStoredLanguage = (): LANGUAGE => {
	try {
		const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
		return isLanguage(stored) ? stored : DEFAULT_LANGUAGE
	} catch {
		return DEFAULT_LANGUAGE
	}
}

const storeLanguage = (language: string) => {
	try {
		localStorage.setItem(LOCALE_STORAGE_KEY, language)
	} catch {
		// Not persisted; the default is used on the next visit.
	}
}

i18n.on('languageChanged', (language) => {
	document.documentElement.lang = language
	storeLanguage(language)
})

void i18n.use(initReactI18next).init({
	resources,
	lng: readStoredLanguage(),
	fallbackLng: DEFAULT_LANGUAGE,
	supportedLngs: Object.values(LANGUAGE),
	interpolation: { escapeValue: false },
})

export default i18n
