import { describe, expect, it } from 'vitest'

import { translationGroup, translationListItemSchema, translationsQuerySchema } from './translations'

const SOURCE_ID = '0b6f6f5e-2f4e-4a3b-9c1d-1e2f3a4b5c6d'
const TARGET_ID = '1c7a7a6f-3a5f-4b4c-8d2e-2f3a4b5c6d7e'

describe('translationsQuerySchema', () => {
	it('applies defaults and treats empty strings as no filter', () => {
		expect(
			translationsQuerySchema.parse({ sourceLanguageId: SOURCE_ID, targetLanguageId: TARGET_ID, search: '  ', status: '', namespace: '', sort: '' }),
		).toEqual({ sourceLanguageId: SOURCE_ID, targetLanguageId: TARGET_ID, sort: 'UNTRANSLATED_FIRST', page: 1, pageSize: 50 })
	})

	it('coerces numbers from query strings and trims search', () => {
		const query = translationsQuerySchema.parse({ sourceLanguageId: SOURCE_ID, targetLanguageId: TARGET_ID, search: ' order ', page: '3', pageSize: '100' })
		expect(query).toMatchObject({ search: 'order', page: 3, pageSize: 100 })
	})

	it('rejects a page size over 100, page 0, an unknown status and a missing language', () => {
		const base = { sourceLanguageId: SOURCE_ID, targetLanguageId: TARGET_ID }
		expect(translationsQuerySchema.safeParse({ ...base, pageSize: '101' }).success).toBe(false)
		expect(translationsQuerySchema.safeParse({ ...base, page: '0' }).success).toBe(false)
		expect(translationsQuerySchema.safeParse({ ...base, status: 'REVIEW' }).success).toBe(false)
		expect(translationsQuerySchema.safeParse({ sourceLanguageId: SOURCE_ID }).success).toBe(false)
	})
})

describe('translationListItemSchema', () => {
	it('allows a missing target row', () => {
		const item = {
			keyId: SOURCE_ID,
			namespace: 'loc',
			name: 'Uložiť',
			group: 'loc',
			source: { value: 'Uložiť' },
			target: { value: null, status: 'UNTRANSLATED', updatedAt: null },
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
