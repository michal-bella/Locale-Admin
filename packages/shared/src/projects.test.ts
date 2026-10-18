import { describe, expect, it } from 'vitest'

import { toValidationIssues, VALIDATION_CODE } from './errors'
import { createProjectRequestSchema, projectListItemSchema, projectMemberSchema } from './projects'

const ID = '0b6f6f5e-2f4e-4a3b-9c1d-1e2f3a4b5c6d'

const issuesOf = (input: unknown) => {
	const result = createProjectRequestSchema.safeParse(input)
	return result.success ? [] : toValidationIssues(result.error)
}

describe('createProjectRequestSchema', () => {
	it('trims values and drops unknown fields', () => {
		expect(createProjectRequestSchema.parse({ name: ' Booking Web ', slug: ' booking-web ', primaryColor: '#000000' })).toEqual({
			name: 'Booking Web',
			slug: 'booking-web',
		})
	})

	it('maps missing fields and an invalid slug to shared codes', () => {
		expect(issuesOf({})).toEqual([
			{ path: 'name', code: VALIDATION_CODE.REQUIRED },
			{ path: 'slug', code: VALIDATION_CODE.REQUIRED },
		])
		expect(issuesOf({ name: 'Booking Web', slug: 'Booking Web' })).toEqual([{ path: 'slug', code: VALIDATION_CODE.INVALID }])
	})
})

describe('projectListItemSchema', () => {
	it('strips fields that are not part of the list', () => {
		const project = { id: ID, name: 'Booking Web', slug: 'booking-web', primaryColor: '#E83E8C', isMember: true, protectVariables: true }
		expect(projectListItemSchema.parse(project)).not.toHaveProperty('protectVariables')
	})
})

describe('projectMemberSchema', () => {
	it('strips passwordHash and role', () => {
		const member = {
			id: ID,
			email: 'jana.novakova@firma.sk',
			firstName: null,
			lastName: null,
			createdAt: '2026-10-18T08:00:00.000Z',
			role: 'EDITOR',
			passwordHash: 'secret-hash',
		}
		expect(projectMemberSchema.parse(member)).toEqual({
			id: ID,
			email: 'jana.novakova@firma.sk',
			firstName: null,
			lastName: null,
			createdAt: '2026-10-18T08:00:00.000Z',
		})
	})
})
