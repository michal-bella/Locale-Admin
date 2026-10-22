import { describe, expect, it } from 'vitest'

import { errorResponseSchema } from './errors'
import { exportQuerySchema } from './exports'

const SK = '0b6f6f5e-2f4e-4a3b-9c1d-1e2f3a4b5c6d'
const EN = '1c7f6f5e-2f4e-4a3b-9c1d-1e2f3a4b5c6d'
const VERSION = '2d8f6f5e-2f4e-4a3b-9c1d-1e2f3a4b5c6d'

describe('exportQuerySchema', () => {
	it('splits comma-separated language ids and defaults the format and status', () => {
		expect(exportQuerySchema.parse({ languageIds: `${SK},${EN}`, versionId: VERSION })).toEqual({
			format: 'CSV',
			languageIds: [SK, EN],
			status: 'ALL',
			versionId: VERSION,
		})
	})

	it('rejects no language, a duplicate language, a non-uuid, an unknown format and a missing version', () => {
		expect(exportQuerySchema.safeParse({ languageIds: '', versionId: VERSION }).success).toBe(false)
		expect(exportQuerySchema.safeParse({ languageIds: `${SK},${SK}`, versionId: VERSION }).success).toBe(false)
		expect(exportQuerySchema.safeParse({ languageIds: 'sk', versionId: VERSION }).success).toBe(false)
		expect(exportQuerySchema.safeParse({ languageIds: SK, format: 'JSON', versionId: VERSION }).success).toBe(false)
		expect(exportQuerySchema.safeParse({ languageIds: SK }).success).toBe(false)
		expect(exportQuerySchema.safeParse({ languageIds: SK, versionId: '' }).success).toBe(false)
	})
})

describe('errorResponseSchema', () => {
	it('accepts unsafe export values as details', () => {
		const details = { issues: [{ code: 'SEMICOLON', keyId: SK, namespace: 'loc', key: 'a', languageTag: 'en' }], total: 1 }
		expect(errorResponseSchema.parse({ error: { code: 'EXPORT_VALUE_UNSAFE', message: '', details } }).error.details).toEqual(details)
	})
})
