import { PROJECT_SLUG_MAX_LENGTH } from '@locale/shared'

import { LANGUAGE } from '@/lib/enum'

export const isLanguage = (value: unknown): value is LANGUAGE => Object.values<unknown>(LANGUAGE).includes(value)

const YIQ_LIGHT_THRESHOLD = 128

/** `true` when a `#RRGGBB` background is light enough for black text (YIQ brightness), otherwise white text reads better. */
export const isLightColor = (hex: string) => {
	const channel = (start: number) => Number.parseInt(hex.slice(start, start + 2), 16)
	return (channel(1) * 299 + channel(3) * 587 + channel(5) * 114) / 1000 >= YIQ_LIGHT_THRESHOLD
}

/** Suggests a project slug from its name: `Booking Web – SK` → `booking-web-sk`. The result still goes through `projectSlugSchema`. */
export const toSlug = (name: string) =>
	name
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, PROJECT_SLUG_MAX_LENGTH)
		.replace(/-+$/, '')

/** Up to two letters from the first two words of a project name: `Booking Web` → `BW`. */
export const getProjectInitials = (name: string) =>
	name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((word) => word[0]?.toUpperCase() ?? '')
		.join('')

/** Initials of a display name that is a full name or, without one, an e-mail (`TranslationEditor.name`): `Jana Nováková` → `JN`, `jana@firma.sk` → `JA`. */
export const getNameInitials = (name: string) => {
	const words = name.trim().split(/\s+/).filter(Boolean)
	const first = words[0] ?? ''
	const last = words.length > 1 ? (words.at(-1) ?? '') : ''
	return (last ? `${first.charAt(0)}${last.charAt(0)}` : first.slice(0, 2)).toUpperCase()
}
