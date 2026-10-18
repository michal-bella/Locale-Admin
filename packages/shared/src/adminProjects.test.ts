import { describe, expect, it } from 'vitest'

import { adminProjectListItemSchema } from './adminProjects'

const PROJECT = {
	id: '0b6f6f5e-2f4e-4a3b-9c1d-1e2f3a4b5c6d',
	name: 'Booking Web',
	slug: 'booking-web',
	primaryColor: '#E83E8C',
	baseLanguageTag: 'sk',
	languageCount: 2,
	memberCount: 3,
	createdAt: '2026-10-18T08:00:00.000Z',
}

describe('adminProjectListItemSchema', () => {
	it('strips fields that are not part of the list', () => {
		expect(adminProjectListItemSchema.parse({ ...PROJECT, protectVariables: true, isMember: false })).toEqual(PROJECT)
	})

	it('allows a project without a base language', () => {
		expect(adminProjectListItemSchema.parse({ ...PROJECT, baseLanguageTag: null, languageCount: 0 }).baseLanguageTag).toBeNull()
	})

	it('rejects a tag outside the catalog and negative counts', () => {
		expect(adminProjectListItemSchema.safeParse({ ...PROJECT, baseLanguageTag: 'fr' }).success).toBe(false)
		expect(adminProjectListItemSchema.safeParse({ ...PROJECT, memberCount: -1 }).success).toBe(false)
	})
})
