import { describe, expect, it } from 'vitest'

import { toValidationIssues, VALIDATION_CODE } from './errors'
import { PROJECT_NAME_MAX_LENGTH, PROJECT_SLUG_MAX_LENGTH, projectSettingsSchema, updateProjectSettingsRequestSchema } from './projectSettings'

const BASE_LANGUAGE_ID = '0b6f6f5e-2f4e-4a3b-9c1d-1e2f3a4b5c6d'

const VALID_REQUEST = {
	name: 'B2B Admin',
	slug: 'b2b-admin',
	primaryColor: '#E83E8C',
	protectVariables: true,
	baseLanguageId: BASE_LANGUAGE_ID,
}

const issuesOf = (input: unknown) => {
	const result = updateProjectSettingsRequestSchema.safeParse(input)
	return result.success ? [] : toValidationIssues(result.error)
}

describe('updateProjectSettingsRequestSchema', () => {
	it('trims values, uppercases the color and drops unknown fields', () => {
		expect(
			updateProjectSettingsRequestSchema.parse({ ...VALID_REQUEST, name: ' B2B Admin ', slug: ' b2b-admin ', primaryColor: '#e83e8c', id: 'x' }),
		).toEqual(VALID_REQUEST)
	})

	it('maps missing fields to shared codes', () => {
		expect(issuesOf({})).toEqual([
			{ path: 'name', code: VALIDATION_CODE.REQUIRED },
			{ path: 'slug', code: VALIDATION_CODE.REQUIRED },
			{ path: 'primaryColor', code: VALIDATION_CODE.REQUIRED },
			{ path: 'protectVariables', code: VALIDATION_CODE.REQUIRED },
			{ path: 'baseLanguageId', code: VALIDATION_CODE.REQUIRED },
		])
	})

	it('rejects a blank or too long name', () => {
		expect(issuesOf({ ...VALID_REQUEST, name: '   ' })).toEqual([{ path: 'name', code: VALIDATION_CODE.REQUIRED }])
		expect(issuesOf({ ...VALID_REQUEST, name: 'a'.repeat(PROJECT_NAME_MAX_LENGTH + 1) })).toEqual([
			{ path: 'name', code: VALIDATION_CODE.TOO_LONG, params: { max: PROJECT_NAME_MAX_LENGTH } },
		])
	})

	it.each(['B2B', '-admin', 'admin-', 'b2b--admin', 'b2b admin', 'b2b_admin'])('rejects the slug %j', (slug) => {
		expect(issuesOf({ ...VALID_REQUEST, slug })).toEqual([{ path: 'slug', code: VALIDATION_CODE.INVALID }])
	})

	it('rejects a too long slug', () => {
		expect(issuesOf({ ...VALID_REQUEST, slug: 'a'.repeat(PROJECT_SLUG_MAX_LENGTH + 1) })).toEqual([
			{ path: 'slug', code: VALIDATION_CODE.TOO_LONG, params: { max: PROJECT_SLUG_MAX_LENGTH } },
		])
	})

	it.each(['#FFF', 'E83E8C', 'red', '#E83E8G'])('rejects the color %j', (primaryColor) => {
		expect(issuesOf({ ...VALID_REQUEST, primaryColor })).toEqual([{ path: 'primaryColor', code: VALIDATION_CODE.INVALID }])
	})

	it('rejects a base language id that is not a UUID', () => {
		expect(issuesOf({ ...VALID_REQUEST, baseLanguageId: 'sk' })).toEqual([{ path: 'baseLanguageId', code: VALIDATION_CODE.INVALID }])
	})
})

describe('projectSettingsSchema', () => {
	it('accepts a missing base language and drops internal fields', () => {
		const project = { id: BASE_LANGUAGE_ID, ...VALID_REQUEST, baseLanguageId: null, createdAt: '2026-10-17T08:00:00.000Z' }
		expect(projectSettingsSchema.parse(project)).toEqual({ id: BASE_LANGUAGE_ID, ...VALID_REQUEST, baseLanguageId: null })
	})
})
