import { describe, expect, it } from 'vitest'

import { toValidationIssues, VALIDATION_CODE } from './errors'
import {
	createTranslationKeyRequestSchema,
	translationGroup,
	translationListItemSchema,
	translationsQuerySchema,
	updateTranslationKeyRequestSchema,
	updateTranslationRequestSchema,
} from './translations'

const SOURCE_ID = '0b6f6f5e-2f4e-4a3b-9c1d-1e2f3a4b5c6d'
const TARGET_ID = '1c7a7a6f-3a5f-4b4c-8d2e-2f3a4b5c6d7e'

describe('translationsQuerySchema', () => {
	it('applies defaults and treats empty strings as no filter', () => {
		expect(
			translationsQuerySchema.parse({ sourceLanguageId: SOURCE_ID, targetLanguageId: TARGET_ID, search: '  ', status: '', namespace: '', sort: '' }),
		).toEqual({ sourceLanguageId: SOURCE_ID, targetLanguageId: TARGET_ID, sort: 'UNTRANSLATED_FIRST', page: 1, pageSize: 20 })
	})

	it('reads the warnings flag from the URL and drops anything else', () => {
		expect(translationsQuerySchema.parse({ warnings: '1' })).toMatchObject({ warnings: true })
		expect(translationsQuerySchema.parse({ warnings: 'true' })).toMatchObject({ warnings: true })
		expect(translationsQuerySchema.parse({ warnings: '' }).warnings).toBeUndefined()
		expect(translationsQuerySchema.parse({ warnings: 'false' }).warnings).toBeUndefined()
	})

	it('coerces numbers from query strings and trims search', () => {
		const query = translationsQuerySchema.parse({ sourceLanguageId: SOURCE_ID, targetLanguageId: TARGET_ID, search: ' order ', page: '3', pageSize: '100' })
		expect(query).toMatchObject({ search: 'order', page: 3, pageSize: 100 })
	})

	it('rejects a page size over 100, page 0 and an unknown status', () => {
		const base = { sourceLanguageId: SOURCE_ID, targetLanguageId: TARGET_ID }
		expect(translationsQuerySchema.safeParse({ ...base, pageSize: '101' }).success).toBe(false)
		expect(translationsQuerySchema.safeParse({ ...base, page: '0' }).success).toBe(false)
		expect(translationsQuerySchema.safeParse({ ...base, status: 'REVIEW' }).success).toBe(false)
	})

	it('parses the editor and period filters', () => {
		const base = { sourceLanguageId: '', targetLanguageId: '' }
		expect(translationsQuerySchema.parse({ ...base, updatedById: SOURCE_ID, updatedWithin: 'WEEK' })).toMatchObject({
			updatedById: SOURCE_ID,
			updatedWithin: 'WEEK',
		})
		expect(translationsQuerySchema.parse({ ...base, updatedById: '', updatedWithin: '' })).toEqual({
			sort: 'UNTRANSLATED_FIRST',
			page: 1,
			pageSize: 20,
		})
		expect(translationsQuerySchema.safeParse({ ...base, updatedWithin: 'YEAR' }).success).toBe(false)
		expect(translationsQuerySchema.safeParse({ ...base, updatedById: 'me' }).success).toBe(false)
	})

	it('accepts no languages (extended view) but not one of the two', () => {
		expect(translationsQuerySchema.parse({ sourceLanguageId: '', targetLanguageId: '' })).toEqual({ sort: 'UNTRANSLATED_FIRST', page: 1, pageSize: 20 })
		const result = translationsQuerySchema.safeParse({ sourceLanguageId: SOURCE_ID })
		expect(result.success ? [] : toValidationIssues(result.error)).toEqual([{ path: 'targetLanguageId', code: VALIDATION_CODE.REQUIRED }])
	})
})

describe('translationListItemSchema', () => {
	it('allows a missing row for a language', () => {
		const item = {
			keyId: SOURCE_ID,
			namespace: 'loc',
			name: 'Uložiť',
			group: 'loc',
			description: null,
			plural: null,
			status: 'UNTRANSLATED',
			translations: {
				[SOURCE_ID]: {
					value: 'Uložiť',
					status: 'TRANSLATED',
					updatedAt: '2026-10-18T12:00:00.000Z',
					updatedBy: { id: TARGET_ID, name: 'Martin Kováč' },
				},
				[TARGET_ID]: { value: null, status: 'UNTRANSLATED', updatedAt: null, updatedBy: null },
			},
		}
		expect(translationListItemSchema.parse(item)).toEqual(item)
	})
})

describe('translationGroup', () => {
	it('adds the path prefix only for keys that look like a path', () => {
		expect(translationGroup('loc', 'orders.empty.title')).toBe('loc:orders.empty')
		expect(translationGroup('', 'orders.title')).toBe('orders')
		expect(translationGroup('loc', 'Adresa nie je kompletná. Uistite sa')).toBe('loc')
		expect(translationGroup('loc', 'save')).toBe('loc')
		expect(translationGroup('loc', 'trailing.')).toBe('loc')
	})
})

describe('updateTranslationRequestSchema', () => {
	it('stores an empty or whitespace-only value as null and keeps text as is', () => {
		expect(updateTranslationRequestSchema.parse({ value: '' })).toEqual({ value: null })
		expect(updateTranslationRequestSchema.parse({ value: '  ' })).toEqual({ value: null })
		expect(updateTranslationRequestSchema.parse({ value: null })).toEqual({ value: null })
		expect(updateTranslationRequestSchema.parse({ value: ' Domov ' })).toEqual({ value: ' Domov ' })
	})

	it('rejects a missing value and a value over the limit', () => {
		expect(updateTranslationRequestSchema.safeParse({}).success).toBe(false)
		expect(updateTranslationRequestSchema.safeParse({ value: 'x'.repeat(10_001) }).success).toBe(false)
	})
})

describe('createTranslationKeyRequestSchema', () => {
	it('trims the name, keeps the namespace as is and stores empty values as null', () => {
		expect(
			createTranslationKeyRequestSchema.parse({ namespace: 'loc', name: ' orders.empty ', translations: { [SOURCE_ID]: 'Prázdne', [TARGET_ID]: ' ' } }),
		).toEqual({
			namespace: 'loc',
			name: 'orders.empty',
			translations: { [SOURCE_ID]: 'Prázdne', [TARGET_ID]: null },
		})
		expect(createTranslationKeyRequestSchema.parse({ namespace: '', name: 'Ahoj' })).toEqual({ namespace: '', name: 'Ahoj', translations: {} })
	})

	it('reports a missing name, a namespace over the limit and a language that is not an id', () => {
		const result = createTranslationKeyRequestSchema.safeParse({ namespace: 'x'.repeat(101), name: '  ', translations: { sk: 'Ahoj' } })
		expect(result.success).toBe(false)
		const issues = toValidationIssues(result.error!)
		expect(issues).toEqual(
			expect.arrayContaining([
				{ path: 'namespace', code: VALIDATION_CODE.TOO_LONG, params: { max: 100 } },
				{ path: 'name', code: VALIDATION_CODE.REQUIRED },
			]),
		)
		expect(issues.some((issue) => issue.path.startsWith('translations'))).toBe(true)
	})
})

describe('updateTranslationKeyRequestSchema', () => {
	it('requires at least one field and defaults the plural variable', () => {
		expect(updateTranslationKeyRequestSchema.safeParse({}).success).toBe(false)
		expect(updateTranslationKeyRequestSchema.parse({ plural: {} })).toEqual({ plural: { variable: 'count' } })
		expect(updateTranslationKeyRequestSchema.parse({ name: ' orders.title ', description: null, plural: null })).toEqual({
			name: 'orders.title',
			description: null,
			plural: null,
		})
	})

	it('rejects an empty name, a name over 2 000 bytes and an invalid variable', () => {
		expect(updateTranslationKeyRequestSchema.safeParse({ name: ' ' }).success).toBe(false)
		expect(updateTranslationKeyRequestSchema.safeParse({ name: 'ž'.repeat(1001) }).success).toBe(false)
		expect(updateTranslationKeyRequestSchema.safeParse({ name: 'ž'.repeat(1000) }).success).toBe(true)
		expect(updateTranslationKeyRequestSchema.safeParse({ plural: { variable: '1x' } }).success).toBe(false)
	})
})
