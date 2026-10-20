import { describe, expect, it } from 'vitest'

import { toValidationIssues, VALIDATION_CODE } from './errors'
import { addProjectMemberRequestSchema, createProjectRequestSchema, projectListItemSchema, projectMemberSchema } from './projects'

const ID = '0b6f6f5e-2f4e-4a3b-9c1d-1e2f3a4b5c6d'

const issuesOf = (input: unknown) => {
	const result = createProjectRequestSchema.safeParse(input)
	return result.success ? [] : toValidationIssues(result.error)
}

describe('createProjectRequestSchema', () => {
	it('trims values and drops unknown fields', () => {
		expect(createProjectRequestSchema.parse({ name: ' Booking Web ', slug: ' booking-web ', languageTags: ['sk', 'en'], primaryColor: '#000000' })).toEqual(
			{
				name: 'Booking Web',
				slug: 'booking-web',
				languageTags: ['sk', 'en'],
			},
		)
	})

	it('maps missing fields and an invalid slug to shared codes', () => {
		expect(issuesOf({})).toEqual([
			{ path: 'name', code: VALIDATION_CODE.REQUIRED },
			{ path: 'slug', code: VALIDATION_CODE.REQUIRED },
			{ path: 'languageTags', code: VALIDATION_CODE.REQUIRED },
		])
		expect(issuesOf({ name: 'Booking Web', slug: 'Booking Web', languageTags: ['sk'] })).toEqual([{ path: 'slug', code: VALIDATION_CODE.INVALID }])
	})

	it('needs at least one catalog language without duplicates', () => {
		const valid = { name: 'Booking Web', slug: 'booking-web' }
		expect(issuesOf({ ...valid, languageTags: [] })).toEqual([{ path: 'languageTags', code: VALIDATION_CODE.REQUIRED }])
		expect(issuesOf({ ...valid, languageTags: ['sk', 'sk'] })).toEqual([{ path: 'languageTags', code: VALIDATION_CODE.INVALID }])
		expect(issuesOf({ ...valid, languageTags: ['fr'] })).toEqual([{ path: 'languageTags.0', code: VALIDATION_CODE.INVALID }])
	})
})

describe('projectListItemSchema', () => {
	it('strips fields that are not part of the list', () => {
		const project = {
			id: ID,
			name: 'Booking Web',
			slug: 'booking-web',
			primaryColor: '#E83E8C',
			isMember: true,
			languageTags: ['sk'],
			keyCount: 0,
			translatedCount: 0,
			protectVariables: true,
		}
		expect(projectListItemSchema.parse(project)).not.toHaveProperty('protectVariables')
	})
})

describe('projectMemberSchema', () => {
	it('keeps role and projectCount and strips passwordHash', () => {
		const member = {
			id: ID,
			email: 'jana.novakova@firma.sk',
			firstName: null,
			lastName: null,
			role: 'EDITOR',
			projectCount: 2,
			createdAt: '2026-10-18T08:00:00.000Z',
			passwordHash: 'secret-hash',
		}
		expect(projectMemberSchema.parse(member)).toEqual({
			id: ID,
			email: 'jana.novakova@firma.sk',
			firstName: null,
			lastName: null,
			role: 'EDITOR',
			projectCount: 2,
			createdAt: '2026-10-18T08:00:00.000Z',
		})
	})

	it('requires role and projectCount', () => {
		const member = { id: ID, email: 'jana.novakova@firma.sk', firstName: null, lastName: null, createdAt: '2026-10-18T08:00:00.000Z' }
		expect(projectMemberSchema.safeParse(member).success).toBe(false)
	})
})

describe('addProjectMemberRequestSchema', () => {
	const issuesOf = (input: unknown) => {
		const result = addProjectMemberRequestSchema.safeParse(input)
		return result.success ? [] : toValidationIssues(result.error)
	}

	it('accepts a user id and drops unknown fields', () => {
		expect(addProjectMemberRequestSchema.parse({ userId: ID, email: 'jana.novakova@firma.sk' })).toEqual({ userId: ID })
	})

	it('maps a missing or malformed user id to shared codes', () => {
		expect(issuesOf({})).toEqual([{ path: 'userId', code: VALIDATION_CODE.REQUIRED }])
		expect(issuesOf({ userId: 'not-a-uuid' })).toEqual([{ path: 'userId', code: VALIDATION_CODE.INVALID }])
	})
})
