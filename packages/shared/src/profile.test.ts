import { describe, expect, it } from 'vitest'

import { ROLE } from './auth'
import { toValidationIssues, VALIDATION_CODE } from './errors'
import { PERSON_NAME_MAX_LENGTH, profileSchema, updateProfileRequestSchema } from './profile'

describe('updateProfileRequestSchema', () => {
	it('trims names and drops fields that are not editable', () => {
		expect(updateProfileRequestSchema.parse({ firstName: ' Martin ', lastName: ' Kováč ', email: 'other@firma.sk', role: ROLE.ADMIN })).toEqual({
			firstName: 'Martin',
			lastName: 'Kováč',
		})
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
			role: ROLE.EDITOR,
			firstName: 'Martin',
			lastName: 'Kováč',
			passwordChangedAt: '2026-07-17T08:00:00.000Z',
			passwordHash: 'secret-hash',
		}
		expect(profileSchema.parse(profile)).not.toHaveProperty('passwordHash')
	})
})
