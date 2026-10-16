import { describe, expect, it } from 'vite-plus/test'

import { ERROR_CODE, VALIDATION_CODE } from '@locale/shared'

import { UNKNOWN_ERROR_CODE } from '@/lib/constants'
import { LANGUAGE } from '@/lib/enum'
import { resources } from '@/lib/i18n'

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
