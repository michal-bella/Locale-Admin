import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { emailSchema } from './email'
import { toValidationIssues, VALIDATION_CODE } from './errors'
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, passwordSchema } from './password'

const schema = z.object({ email: emailSchema, password: passwordSchema })

const issuesFor = (input: unknown) => {
	const result = schema.safeParse(input)
	return result.success ? [] : toValidationIssues(result.error)
}

describe('toValidationIssues', () => {
	it('maps missing fields to REQUIRED', () => {
		expect(issuesFor({})).toEqual([
			{ path: 'email', code: VALIDATION_CODE.REQUIRED },
			{ path: 'password', code: VALIDATION_CODE.REQUIRED },
		])
	})

	it('maps an empty email to REQUIRED and a malformed one to INVALID_EMAIL', () => {
		expect(issuesFor({ email: '  ', password: 'x'.repeat(PASSWORD_MIN_LENGTH) })).toEqual([{ path: 'email', code: VALIDATION_CODE.REQUIRED }])
		expect(issuesFor({ email: 'not-an-email', password: 'x'.repeat(PASSWORD_MIN_LENGTH) })).toEqual([
			{ path: 'email', code: VALIDATION_CODE.INVALID_EMAIL },
		])
	})

	it('maps password length to TOO_SHORT and TOO_LONG with params', () => {
		expect(issuesFor({ email: 'a@b.sk', password: 'short' })).toEqual([
			{ path: 'password', code: VALIDATION_CODE.TOO_SHORT, params: { min: PASSWORD_MIN_LENGTH } },
		])
		expect(issuesFor({ email: 'a@b.sk', password: 'x'.repeat(PASSWORD_MAX_LENGTH + 1) })).toEqual([
			{ path: 'password', code: VALIDATION_CODE.TOO_LONG, params: { max: PASSWORD_MAX_LENGTH } },
		])
	})
})

describe('emailSchema', () => {
	it('normalizes case and whitespace', () => {
		expect(emailSchema.parse('  Michal.Bella@GoodRequest.com ')).toBe('michal.bella@goodrequest.com')
	})
})
