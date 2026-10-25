import { describe, expect, it } from 'vitest'

import { ROLE } from './auth'
import { toValidationIssues, VALIDATION_CODE } from './errors'
import { PERSON_NAME_MAX_LENGTH, profileSchema, updatePreferencesRequestSchema, updateProfileRequestSchema } from './profile'

describe('updateProfileRequestSchema', () => {
	it('trims names, keeps the optional role and drops the email', () => {
		expect(updateProfileRequestSchema.parse({ firstName: ' Martin ', lastName: ' Kováč ', email: 'other@firma.sk', role: ROLE.ADMIN })).toEqual({
			firstName: 'Martin',
			lastName: 'Kováč',
			role: ROLE.ADMIN,
		})
		expect(updateProfileRequestSchema.parse({ firstName: 'Martin', lastName: 'Kováč' })).toEqual({ firstName: 'Martin', lastName: 'Kováč' })
		expect(updateProfileRequestSchema.safeParse({ firstName: 'Martin', lastName: 'Kováč', role: ROLE.USER }).success).toBe(true)
		expect(updateProfileRequestSchema.safeParse({ firstName: 'Martin', lastName: 'Kováč', role: 'OWNER' }).success).toBe(false)
	})

	it('maps missing, blank and too long names to shared codes', () => {
		const missing = updateProfileRequestSchema.safeParse({})
		expect(missing.success ? [] : toValidationIssues(missing.error)).toEqual([
			{ path: 'firstName', code: VALIDATION_CODE.REQUIRED },
			{ path: 'lastName', code: VALIDATION_CODE.REQUIRED },
		])

		const invalid = updateProfileRequestSchema.safeParse({ firstName: '   ', lastName: 'a'.repeat(PERSON_NAME_MAX_LENGTH + 1) })
		expect(invalid.success ? [] : toValidationIssues(invalid.error)).toEqual([
			{ path: 'firstName', code: VALIDATION_CODE.REQUIRED },
			{ path: 'lastName', code: VALIDATION_CODE.TOO_LONG, params: { max: PERSON_NAME_MAX_LENGTH } },
		])
	})
})

describe('profileSchema', () => {
	it('strips passwordHash', () => {
		const profile = {
			id: '0b6f6f5e-2f4e-4a3b-9c1d-1e2f3a4b5c6d',
			email: 'martin.kovac@firma.sk',
			role: ROLE.USER,
			firstName: 'Martin',
			lastName: 'Kováč',
			preferences: { translationsView: 'EXTENDED', translationsLayout: 'COLUMNS' },
			passwordChangedAt: '2026-07-17T08:00:00.000Z',
			passwordHash: 'secret-hash',
		}
		expect(profileSchema.parse(profile)).not.toHaveProperty('passwordHash')
	})
})

describe('updatePreferencesRequestSchema', () => {
	it('accepts only a known view', () => {
		expect(updatePreferencesRequestSchema.parse({ translationsView: 'COMPACT' })).toEqual({ translationsView: 'COMPACT' })
		const result = updatePreferencesRequestSchema.safeParse({ translationsView: 'WIDE' })
		expect(result.success ? [] : toValidationIssues(result.error)).toEqual([{ path: 'translationsView', code: VALIDATION_CODE.INVALID }])
	})

	it('accepts the layout alone and rejects an empty body', () => {
		expect(updatePreferencesRequestSchema.parse({ translationsLayout: 'STACKED' })).toEqual({ translationsLayout: 'STACKED' })
		expect(updatePreferencesRequestSchema.safeParse({ translationsLayout: 'GRID' }).success).toBe(false)
		expect(updatePreferencesRequestSchema.safeParse({}).success).toBe(false)
	})
})
