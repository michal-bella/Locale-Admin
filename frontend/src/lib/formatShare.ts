/**
 * `part` of `total` as a whole percent in the given UI language. A share that rounds to 0 % or 100 % but is not exactly that comes back as
 * `1 %` / `99 %` with a `bound`, so a single untranslated value never reads as 100 % translated.
 */
export const formatShare = (part: number, total: number, locale: string): { percent: string; bound?: 'lessThan' | 'moreThan' } => {
	const format = (ratio: number) => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(ratio)
	const ratio = total === 0 ? 0 : part / total
	if (ratio > 0 && ratio < 0.01) {
		return { percent: format(0.01), bound: 'lessThan' }
	}
	if (ratio > 0.99 && ratio < 1) {
		return { percent: format(0.99), bound: 'moreThan' }
	}
	return { percent: format(ratio) }
}
