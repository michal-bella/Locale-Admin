import { describe, expect, it } from 'vitest'

import { getInitials, loginRequestSchema } from './auth'
import { toValidationIssues, VALIDATION_CODE } from './errors'

describe('loginRequestSchema', () => {
	it('normalizes the email and accepts any non-empty password', () => {
		expect(loginRequestSchema.parse({ email: ' Michal.Bella@GoodRequest.com ', password: 'x' })).toEqual({
			email: 'michal.bella@goodrequest.com',
			password: 'x',
		})
	})

	it('requires both fields', () => {
		const result = loginRequestSchema.safeParse({ email: '', password: '' })
		expect(result.success ? [] : toValidationIssues(result.error)).toEqual([
			{ path: 'email', code: VALIDATION_CODE.REQUIRED },
			{ path: 'password', code: VALIDATION_CODE.REQUIRED },
		])
	})
})

describe('getInitials', () => {
	it('uses first and last name when both exist', () => {
		expect(getInitials({ email: 'martin.kovac@firma.sk', firstName: 'martin', lastName: 'Kováč' })).toBe('MK')
	})

	it('falls back to the first two letters of the email', () => {
		expect(getInitials({ email: 'martin.kovac@firma.sk', firstName: null, lastName: null })).toBe('MA')
		expect(getInitials({ email: 'martin.kovac@firma.sk', firstName: 'Martin', lastName: ' ' })).toBe('MA')
	})
})
