import { describe, expect, it } from 'vite-plus/test'

import { getProjectInitials, isLightColor, toSlug } from '@/lib/utils'

describe('isLightColor', () => {
	it.each([
		['#FFFFFF', true],
		['#FACC15', true],
		['#E2E8F0', true],
		['#000000', false],
		['#E83E8C', false],
		['#1D4ED8', false],
	])('%s → %s', (hex, light) => {
		expect(isLightColor(hex)).toBe(light)
	})
})

describe('toSlug', () => {
	it.each([
		['Booking Web', 'booking-web'],
		['  Žltý kôň – B2C iOS! ', 'zlty-kon-b2c-ios'],
		['---', ''],
		[`${'a'.repeat(49)} b`, 'a'.repeat(49)],
	])('%j → %j', (name, slug) => {
		expect(toSlug(name)).toBe(slug)
	})
})

describe('getProjectInitials', () => {
	it.each([
		['Booking Web', 'BW'],
		['demo project app', 'DP'],
		['B2B', 'B'],
		['  ', ''],
	])('%j → %j', (name, initials) => {
		expect(getProjectInitials(name)).toBe(initials)
	})
})
