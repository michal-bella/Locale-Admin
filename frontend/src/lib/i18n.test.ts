import { describe, expect, it } from 'vite-plus/test'

import { ERROR_CODE, IMPORT_ISSUE_CODES, VALIDATION_CODE } from '@locale/shared'

import { UNKNOWN_ERROR_CODE } from '@/lib/constants'
import { LANGUAGE } from '@/lib/enum'
import { resources } from '@/lib/i18n'

const flatten = (value: unknown, prefix = ''): Record<string, unknown> =>
	typeof value === 'object' && value !== null
		? Object.fromEntries(Object.entries(value).flatMap(([key, child]) => Object.entries(flatten(child, prefix ? `${prefix}.${key}` : key))))
		: { [prefix]: value }

const flatTranslations = Object.fromEntries(Object.values(LANGUAGE).map((language) => [language, flatten(resources[language].translation)])) as Record<
	LANGUAGE,
	Record<string, unknown>
>

describe('translation key parity', () => {
	it('has the same keys in every language', () => {
		const allKeys = new Set(Object.values(flatTranslations).flatMap((translation) => Object.keys(translation)))
		const missing = Object.fromEntries(
			Object.values(LANGUAGE).map((language) => [language, [...allKeys].filter((key) => !(key in flatTranslations[language])).sort()]),
		)
		expect(missing).toEqual(Object.fromEntries(Object.values(LANGUAGE).map((language) => [language, []])))
	})

	it.each(Object.values(LANGUAGE))('has no empty string values (%s)', (language) => {
		const empty = Object.entries(flatTranslations[language])
			.filter(([, value]) => value === '')
			.map(([key]) => key)
		expect(empty).toEqual([])
	})
})

describe.each(Object.values(LANGUAGE))('translations (%s)', (language) => {
	const { translation } = resources[language]

	it.each([...Object.values(ERROR_CODE), UNKNOWN_ERROR_CODE])('has errors.%s', (code) => {
		expect(translation.errors).toHaveProperty(code, expect.any(String))
	})

	it.each(Object.values(VALIDATION_CODE))('has validation.%s', (code) => {
		expect(translation.validation).toHaveProperty(code, expect.any(String))
	})

	it.each(IMPORT_ISSUE_CODES)('has importIssues.%s', (code) => {
		expect(translation.importIssues).toHaveProperty(code, expect.any(String))
	})

	it('interpolates length limits', () => {
		expect(translation.validation.TOO_SHORT).toContain('{{min}}')
		expect(translation.validation.TOO_LONG).toContain('{{max}}')
	})
})
