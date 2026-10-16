import { DEFAULT_LANGUAGE } from '@/lib/constants'
import { LANGUAGE } from '@/lib/enum'

const DATE_LOCALE: Record<LANGUAGE, string> = {
	[LANGUAGE.SK]: 'sk-SK',
	[LANGUAGE.EN]: 'en-GB',
}

const isLanguage = (value: string): value is LANGUAGE => Object.values<string>(LANGUAGE).includes(value)

/** Numeric date in the UI language: `sk` → `12. 10. 2026`, `en` → `12/10/2026`. */
export const formatDate = (isoDate: string, language: string) =>
	new Intl.DateTimeFormat(DATE_LOCALE[isLanguage(language) ? language : DEFAULT_LANGUAGE], {
		day: 'numeric',
		month: 'numeric',
		year: 'numeric',
	}).format(new Date(isoDate))
