import { describe, expect, it } from 'vite-plus/test'

import { isLightColor } from '@/lib/utils'

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
