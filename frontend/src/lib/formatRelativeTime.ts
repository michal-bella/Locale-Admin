import { toIntlLocale } from '@/lib/formatDate'

const SECONDS_PER_UNIT: [Intl.RelativeTimeFormatUnit, number][] = [
	['year', 365 * 24 * 60 * 60],
	['month', 30 * 24 * 60 * 60],
	['week', 7 * 24 * 60 * 60],
	['day', 24 * 60 * 60],
	['hour', 60 * 60],
	['minute', 60],
	['second', 1],
]

/** Time relative to `now` in the UI language with the largest fitting unit: `sk` → `pred 3 mesiacmi`, `včera`; `en` → `3 months ago`, `yesterday`. */
export const formatRelativeTime = (isoDate: string, language: string, now: Date = new Date()) => {
	const diffSeconds = (new Date(isoDate).getTime() - now.getTime()) / 1000
	const [unit, seconds] = SECONDS_PER_UNIT.find(([, unitSeconds]) => Math.abs(diffSeconds) >= unitSeconds) ?? ['second', 1]
	return new Intl.RelativeTimeFormat(toIntlLocale(language), { numeric: 'auto' }).format(Math.round(diffSeconds / seconds), unit)
}
