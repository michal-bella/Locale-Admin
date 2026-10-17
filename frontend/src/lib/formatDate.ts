import { DEFAULT_LANGUAGE } from '@/lib/constants'
import { LANGUAGE } from '@/lib/enum'
import { isLanguage } from '@/lib/utils'

const DATE_LOCALE: Record<LANGUAGE, string> = {
	[LANGUAGE.SK]: 'sk-SK',
	[LANGUAGE.EN]: 'en-GB',
}

/** `Intl` locale for a UI language; an unknown language falls back to `sk`. */
export const toIntlLocale = (language: string) => DATE_LOCALE[isLanguage(language) ? language : DEFAULT_LANGUAGE]

/** Numeric date in the UI language: `sk` → `12. 10. 2026`, `en` → `12/10/2026`. */
export const formatDate = (isoDate: string, language: string) =>
	new Intl.DateTimeFormat(toIntlLocale(language), {
		day: 'numeric',
		month: 'numeric',
		year: 'numeric',
	}).format(new Date(isoDate))
