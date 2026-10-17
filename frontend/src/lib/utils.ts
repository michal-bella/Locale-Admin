import { LANGUAGE } from '@/lib/enum'

export const isLanguage = (value: unknown): value is LANGUAGE => Object.values<unknown>(LANGUAGE).includes(value)

const YIQ_LIGHT_THRESHOLD = 128

/** `true` when a `#RRGGBB` background is light enough for black text (YIQ brightness), otherwise white text reads better. */
export const isLightColor = (hex: string) => {
	const channel = (start: number) => Number.parseInt(hex.slice(start, start + 2), 16)
	return (channel(1) * 299 + channel(3) * 587 + channel(5) * 114) / 1000 >= YIQ_LIGHT_THRESHOLD
}
