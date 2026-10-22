import { describe, expect, it } from 'vitest'

import { dashboardResponseSchema } from './dashboard'

describe('dashboardResponseSchema', () => {
	const body = {
		version: { id: '0b6f6f5e-2f4e-4a3b-9c1d-1e2f3a4b5c6d', name: 'v2.45' },
		keys: { total: 10, createdLast30Days: 2 },
		translatedKeys: 4,
		strings: { filled: 15, total: 20 },
		baseWords: 31,
	}

	it('accepts the statistics and strips unknown fields', () => {
		expect(dashboardResponseSchema.parse({ ...body, languages: [] })).toEqual(body)
	})

	it('rejects negative and fractional counts', () => {
		expect(dashboardResponseSchema.safeParse({ ...body, translatedKeys: -1 }).success).toBe(false)
		expect(dashboardResponseSchema.safeParse({ ...body, baseWords: 1.5 }).success).toBe(false)
	})
})
