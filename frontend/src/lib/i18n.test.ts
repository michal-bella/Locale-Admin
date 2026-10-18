import { describe, expect, it } from 'vite-plus/test'

import { ERROR_CODE, VALIDATION_CODE } from '@locale/shared'

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

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/

// Plural forms differ per language (sk and cs have few and many, en does not), so they are compared by their base key.
const baseKeys = (language: LANGUAGE) => new Set(Object.keys(flatTranslations[language]).map((key) => key.replace(PLURAL_SUFFIX, '')))

describe('translation key parity', () => {
	it('has the same keys in every language', () => {
		const allKeys = new Set(Object.values(LANGUAGE).flatMap((language) => [...baseKeys(language)]))
		const missing = Object.fromEntries(
			Object.values(LANGUAGE).map((language) => [language, [...allKeys].filter((key) => !baseKeys(language).has(key)).sort()]),
		)
		expect(missing).toEqual(Object.fromEntries(Object.values(LANGUAGE).map((language) => [language, []])))
	})

	it.each(Object.values(LANGUAGE))('has every plural form of the language (%s)', (language) => {
		const keys = Object.keys(flatTranslations[language])
		const pluralKeys = new Set(keys.filter((key) => PLURAL_SUFFIX.test(key)).map((key) => key.replace(PLURAL_SUFFIX, '')))
		const { pluralCategories } = new Intl.PluralRules(language).resolvedOptions()
		const missing = [...pluralKeys].flatMap((key) =>
			pluralCategories.filter((category) => !keys.includes(`${key}_${category}`)).map((category) => `${key}_${category}`),
		)
		expect(missing).toEqual([])
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

	it('interpolates length limits', () => {
		expect(translation.validation.TOO_SHORT).toContain('{{min}}')
		expect(translation.validation.TOO_LONG).toContain('{{max}}')
	})
})
