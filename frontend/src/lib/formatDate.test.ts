import { describe, expect, it } from 'vite-plus/test'

import { LANGUAGE } from '@/lib/enum'
import { formatDate } from '@/lib/formatDate'

describe('formatDate', () => {
	it.each([
		[LANGUAGE.SK, '2026-10-12T10:00:00.000Z', '12. 10. 2026'],
		[LANGUAGE.SK, '2026-10-03T10:00:00.000Z', '3. 10. 2026'],
		[LANGUAGE.EN, '2026-10-12T10:00:00.000Z', '12/10/2026'],
		[LANGUAGE.EN, '2026-10-03T10:00:00.000Z', '03/10/2026'],
	])('formats in %s: %s → %s', (language, isoDate, expected) => {
		expect(formatDate(isoDate, language)).toBe(expected)
	})

	it('falls back to sk for an unknown language', () => {
		expect(formatDate('2026-10-12T10:00:00.000Z', 'de')).toBe('12. 10. 2026')
	})
})
