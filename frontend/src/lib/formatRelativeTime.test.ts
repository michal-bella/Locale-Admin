import { describe, expect, it } from 'vite-plus/test'

import { LANGUAGE } from '@/lib/enum'
import { formatRelativeTime } from '@/lib/formatRelativeTime'

const NOW = new Date('2026-10-17T12:00:00.000Z')

const ago = (seconds: number) => new Date(NOW.getTime() - seconds * 1000).toISOString()

const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

describe('formatRelativeTime', () => {
	it.each([
		[LANGUAGE.SK, 0, 'teraz'],
		[LANGUAGE.SK, 5 * MINUTE, 'pred 5 minútami'],
		[LANGUAGE.SK, 3 * HOUR, 'pred 3 hodinami'],
		[LANGUAGE.SK, DAY, 'včera'],
		[LANGUAGE.SK, 14 * DAY, 'pred 2 týždňami'],
		[LANGUAGE.SK, 90 * DAY, 'pred 3 mesiacmi'],
		[LANGUAGE.SK, 2 * 365 * DAY, 'pred 2 rokmi'],
		[LANGUAGE.EN, 0, 'now'],
		[LANGUAGE.EN, 5 * MINUTE, '5 minutes ago'],
		[LANGUAGE.EN, DAY, 'yesterday'],
		[LANGUAGE.EN, 90 * DAY, '3 months ago'],
		[LANGUAGE.EN, 2 * 365 * DAY, '2 years ago'],
	])('formats in %s: %i s ago → %s', (language, seconds, expected) => {
		expect(formatRelativeTime(ago(seconds), language, NOW)).toBe(expected)
	})

	it('falls back to sk for an unknown language', () => {
		expect(formatRelativeTime(ago(90 * DAY), 'de', NOW)).toBe('pred 3 mesiacmi')
	})
})
