import 'dayjs/locale/cs'
import 'dayjs/locale/en-gb'
import 'dayjs/locale/sk'

import { DEFAULT_LANGUAGE } from '@/lib/constants'
import { LANGUAGE } from '@/lib/enum'
import { isLanguage } from '@/lib/utils'

const DAYJS_LOCALE: Record<LANGUAGE, string> = {
	[LANGUAGE.SK]: 'sk',
	[LANGUAGE.EN]: 'en-gb',
	[LANGUAGE.CS]: 'cs',
}

/** dayjs locale of the calendar (month names, first day of the week) for a UI language. */
export const toDayjsLocale = (language: string) => DAYJS_LOCALE[isLanguage(language) ? language : DEFAULT_LANGUAGE]

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const NUMERIC_DATE = /^\s*(\d{1,2})\s*[./]\s*(\d{1,2})\s*[./]\s*(\d{4})\s*$/

const toIsoDate = (year: number, month: number, day: number) => {
	const date = new Date(Date.UTC(year, month - 1, day))
	const valid = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
	return valid ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` : null
}

/** Typed date as `YYYY-MM-DD`: the contract format or the numeric day-first form of the UI (`22. 10. 2026`, `22/10/2026`); anything else is `null`. */
export const parseDateInput = (input: string) => {
	const iso = ISO_DATE.exec(input)
	if (iso) {
		return toIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]))
	}
	const numeric = NUMERIC_DATE.exec(input)
	return numeric ? toIsoDate(Number(numeric[3]), Number(numeric[2]), Number(numeric[1])) : null
}
