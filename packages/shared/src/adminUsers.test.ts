import { describe, expect, it } from 'vitest'

import { adminUserDetailSchema, adminUserSchema, createUserRequestSchema } from './adminUsers'
import { ROLE } from './auth'
import { toValidationIssues, VALIDATION_CODE } from './errors'
import { PASSWORD_MIN_LENGTH } from './password'

describe('createUserRequestSchema', () => {
	it('normalizes the email, keeps the role and drops unknown fields', () => {
		expect(createUserRequestSchema.parse({ email: ' Jana.Novakova@Firma.SK ', password: 'password1', role: ROLE.EDITOR, isActive: false })).toEqual({
			email: 'jana.novakova@firma.sk',
			password: 'password1',
			role: ROLE.EDITOR,
		})
	})

	it('accepts every global role', () => {
		for (const role of Object.values(ROLE)) {
			expect(createUserRequestSchema.safeParse({ email: 'jana@firma.sk', password: 'password1', role }).success).toBe(true)
		}
	})

	it('maps missing fields, an invalid email, a short password and an unknown role to shared codes', () => {
		const missing = createUserRequestSchema.safeParse({})
		expect(missing.success ? [] : toValidationIssues(missing.error)).toEqual([
			{ path: 'email', code: VALIDATION_CODE.REQUIRED },
			{ path: 'password', code: VALIDATION_CODE.REQUIRED },
			{ path: 'role', code: VALIDATION_CODE.INVALID },
		])

		const invalid = createUserRequestSchema.safeParse({ email: 'not-an-email', password: 'short', role: 'OWNER' })
		expect(invalid.success ? [] : toValidationIssues(invalid.error)).toEqual([
			{ path: 'email', code: VALIDATION_CODE.INVALID_EMAIL },
			{ path: 'password', code: VALIDATION_CODE.TOO_SHORT, params: { min: PASSWORD_MIN_LENGTH } },
			{ path: 'role', code: VALIDATION_CODE.INVALID },
		])
	})
})

describe('adminUserSchema', () => {
	it('strips passwordHash', () => {
		const user = {
			id: '0b6f6f5e-2f4e-4a3b-9c1d-1e2f3a4b5c6d',
			email: 'jana.novakova@firma.sk',
			role: ROLE.EDITOR,
			projectCount: 2,
			createdAt: '2026-10-12T08:00:00.000Z',
			passwordHash: 'secret-hash',
		}
		expect(adminUserSchema.parse(user)).not.toHaveProperty('passwordHash')
	})
})

describe('adminUserDetailSchema', () => {
	it('keeps the user fields and the projects, strips passwordHash and project counts', () => {
		const detail = {
			id: '0b6f6f5e-2f4e-4a3b-9c1d-1e2f3a4b5c6d',
			email: 'jana.novakova@firma.sk',
			role: ROLE.EDITOR,
			projectCount: 1,
			createdAt: '2026-10-12T08:00:00.000Z',
			passwordHash: 'secret-hash',
			projects: [
				{
					id: '6f1c0f8e-1b7e-4c47-9a53-0a4b1f3e2d11',
					name: 'Booking Web',
					slug: 'booking-web',
					primaryColor: '#E83E8C',
					joinedAt: '2026-10-13T08:00:00.000Z',
					memberCount: 3,
				},
			],
		}
		expect(adminUserDetailSchema.parse(detail)).toEqual({
			id: detail.id,
			email: detail.email,
			role: ROLE.EDITOR,
			projectCount: 1,
			createdAt: detail.createdAt,
			projects: [
				{
					id: '6f1c0f8e-1b7e-4c47-9a53-0a4b1f3e2d11',
					name: 'Booking Web',
					slug: 'booking-web',
					primaryColor: '#E83E8C',
					joinedAt: '2026-10-13T08:00:00.000Z',
				},
			],
		})
	})

	it('rejects a project without joinedAt', () => {
		expect(
			adminUserDetailSchema.safeParse({
				id: '0b6f6f5e-2f4e-4a3b-9c1d-1e2f3a4b5c6d',
				email: 'jana.novakova@firma.sk',
				role: ROLE.EDITOR,
				projectCount: 1,
				createdAt: '2026-10-12T08:00:00.000Z',
				projects: [{ id: '6f1c0f8e-1b7e-4c47-9a53-0a4b1f3e2d11', name: 'Booking Web', slug: 'booking-web', primaryColor: '#E83E8C' }],
			}).success,
		).toBe(false)
	})
})
