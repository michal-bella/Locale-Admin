import { describe, expect, it } from 'vitest'

import { adminUserSchema, createUserRequestSchema } from './adminUsers'
import { ROLE } from './auth'
import { toValidationIssues, VALIDATION_CODE } from './errors'
import { PASSWORD_MIN_LENGTH } from './password'

describe('createUserRequestSchema', () => {
	it('normalizes the email and drops unknown fields such as role', () => {
		expect(createUserRequestSchema.parse({ email: ' Jana.Novakova@Firma.SK ', password: 'password1', role: ROLE.ADMIN })).toEqual({
			email: 'jana.novakova@firma.sk',
			password: 'password1',
		})
	})

	it('maps missing fields, an invalid email and a short password to shared codes', () => {
		const missing = createUserRequestSchema.safeParse({})
		expect(missing.success ? [] : toValidationIssues(missing.error)).toEqual([
			{ path: 'email', code: VALIDATION_CODE.REQUIRED },
			{ path: 'password', code: VALIDATION_CODE.REQUIRED },
		])

		const invalid = createUserRequestSchema.safeParse({ email: 'not-an-email', password: 'short' })
		expect(invalid.success ? [] : toValidationIssues(invalid.error)).toEqual([
			{ path: 'email', code: VALIDATION_CODE.INVALID_EMAIL },
			{ path: 'password', code: VALIDATION_CODE.TOO_SHORT, params: { min: PASSWORD_MIN_LENGTH } },
		])
	})
})

describe('adminUserSchema', () => {
	it('strips passwordHash', () => {
		const user = {
			id: '0b6f6f5e-2f4e-4a3b-9c1d-1e2f3a4b5c6d',
			email: 'jana.novakova@firma.sk',
			role: ROLE.EDITOR,
			createdAt: '2026-10-12T08:00:00.000Z',
			passwordHash: 'secret-hash',
		}
		expect(adminUserSchema.parse(user)).not.toHaveProperty('passwordHash')
	})
})
