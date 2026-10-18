import { describe, expect, it } from 'vitest'

import { toValidationIssues, VALIDATION_CODE } from './errors'
import { createLanguageRequestSchema, LANGUAGE_FLAG_CODES, LANGUAGE_TAGS, languageSchema, SUPPORTED_LANGUAGES } from './languages'

describe('SUPPORTED_LANGUAGES', () => {
	it('has 9 languages with unique tags and flags', () => {
		expect(LANGUAGE_TAGS).toEqual(['bg', 'cs', 'de-AT', 'en', 'hr', 'hu', 'ro', 'ru', 'sk'])
		expect(new Set(LANGUAGE_TAGS).size).toBe(SUPPORTED_LANGUAGES.length)
		expect(LANGUAGE_FLAG_CODES).toHaveLength(SUPPORTED_LANGUAGES.length)
	})
})

describe('createLanguageRequestSchema', () => {
	it('accepts a tag from the catalog', () => {
		expect(createLanguageRequestSchema.parse({ tag: 'de-AT' })).toEqual({ tag: 'de-AT' })
	})

	// zod 4 does not report the input of an enum issue, so a missing tag is INVALID, not REQUIRED.
	it('rejects a missing tag and a tag outside the catalog', () => {
		const missing = createLanguageRequestSchema.safeParse({})
		expect(missing.success ? [] : toValidationIssues(missing.error)).toEqual([{ path: 'tag', code: VALIDATION_CODE.INVALID }])

		const unsupported = createLanguageRequestSchema.safeParse({ tag: 'fr' })
		expect(unsupported.success ? [] : toValidationIssues(unsupported.error)).toEqual([{ path: 'tag', code: VALIDATION_CODE.INVALID }])
	})
})

describe('languageSchema', () => {
	it('parses a stored language and drops internal fields', () => {
		const language = {
			id: '0b6f6f5e-2f4e-4a3b-9c1d-1e2f3a4b5c6d',
			tag: 'sk',
			englishName: 'Slovak',
			nativeName: 'slovenčina',
			flagCode: 'sk',
			isBase: true,
			createdAt: '2026-10-17T08:00:00.000Z',
			updatedAt: '2026-10-17T09:00:00.000Z',
		}
		expect(languageSchema.parse(language)).not.toHaveProperty('updatedAt')
	})
})
