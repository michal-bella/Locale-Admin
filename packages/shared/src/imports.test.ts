import { describe, expect, it } from 'vitest'

import { errorResponseSchema } from './errors'
import { importPreviewRequestSchema, importRequestSchema } from './imports'

const LANGUAGE_ID = '0b6f6f5e-2f4e-4a3b-9c1d-1e2f3a4b5c6d'

describe('importPreviewRequestSchema', () => {
	it('accepts a CSV file name in any case and rejects other extensions', () => {
		expect(importPreviewRequestSchema.safeParse({ fileName: 'translations.CSV', content: '', versionId: LANGUAGE_ID }).success).toBe(true)
		expect(importPreviewRequestSchema.safeParse({ fileName: 'translations.json', content: '', versionId: LANGUAGE_ID }).success).toBe(false)
		expect(importPreviewRequestSchema.safeParse({ fileName: ' ', content: '', versionId: LANGUAGE_ID }).success).toBe(false)
		expect(importPreviewRequestSchema.safeParse({ fileName: 'translations.csv', content: '' }).success).toBe(false)
	})
})

describe('importRequestSchema', () => {
	it('defaults createMissingKeys to true and allows a skipped column', () => {
		expect(
			importRequestSchema.parse({
				fileName: 'a.csv',
				content: 'x',
				versionId: LANGUAGE_ID,
				columns: [
					{ columnIndex: 2, languageId: LANGUAGE_ID },
					{ columnIndex: 3, languageId: null },
				],
			}),
		).toMatchObject({ createMissingKeys: true })
	})

	it('rejects an empty column list, the Keys column and a missing version', () => {
		const columns = [{ columnIndex: 2, languageId: LANGUAGE_ID }]
		expect(importRequestSchema.safeParse({ fileName: 'a.csv', content: 'x', versionId: LANGUAGE_ID, columns: [] }).success).toBe(false)
		expect(
			importRequestSchema.safeParse({ fileName: 'a.csv', content: 'x', versionId: LANGUAGE_ID, columns: [{ columnIndex: 1, languageId: null }] }).success,
		).toBe(false)
		expect(importRequestSchema.safeParse({ fileName: 'a.csv', content: 'x', columns }).success).toBe(false)
	})
})

describe('errorResponseSchema', () => {
	it('accepts field issues and import file issues as details', () => {
		expect(errorResponseSchema.safeParse({ error: { code: 'VALIDATION_ERROR', message: '', details: [{ path: 'tag', code: 'INVALID' }] } }).success).toBe(
			true,
		)
		expect(
			errorResponseSchema.safeParse({
				error: {
					code: 'IMPORT_FILE_INVALID',
					message: '',
					details: { issues: [{ code: 'ROW_COLUMN_COUNT', line: 812, params: { expected: 10, actual: 11 } }], total: 1 },
				},
			}).success,
		).toBe(true)
	})
})
