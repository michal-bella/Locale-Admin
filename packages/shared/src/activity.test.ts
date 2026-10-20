import { describe, expect, it } from 'vitest'

import { ACTIVITY_TYPE, activityEventDataSchema } from './activity'

const KEY_ID = '0b6f6f5e-2f4e-4a3b-9c1d-1e2f3a4b5c6d'

const MEMBER = { id: KEY_ID, firstName: 'Jana', lastName: null, email: 'jana@firma.sk' }

describe('activityEventDataSchema', () => {
	it('accepts the payload of every type', () => {
		const events = [
			{ type: ACTIVITY_TYPE.PROJECT_CREATED, payload: { name: 'B2B Admin' } },
			{ type: ACTIVITY_TYPE.PROJECT_UPDATED, payload: { fields: ['name', 'protectVariables'] } },
			{ type: ACTIVITY_TYPE.LANGUAGE_ADDED, payload: { tag: 'en' } },
			{ type: ACTIVITY_TYPE.LANGUAGE_REMOVED, payload: { tag: 'en' } },
			{ type: ACTIVITY_TYPE.BASE_LANGUAGE_CHANGED, payload: { fromTag: null, toTag: 'sk' } },
			{ type: ACTIVITY_TYPE.MEMBER_ADDED, payload: { member: MEMBER } },
			{ type: ACTIVITY_TYPE.MEMBER_REMOVED, payload: { member: MEMBER, left: true } },
			{ type: ACTIVITY_TYPE.KEYS_IMPORTED, payload: { keysCreated: 2, translationsCreated: 3, translationsUpdated: 0, languageTags: ['sk', 'en'] } },
			{ type: ACTIVITY_TYPE.KEY_UPDATED, payload: { keyId: KEY_ID, namespace: 'loc', name: 'Uložiť', fields: ['description'] } },
			{
				type: ACTIVITY_TYPE.TRANSLATION_UPDATED,
				payload: { keyId: KEY_ID, namespace: '', name: 'Uložiť', languageTag: 'en', oldValue: null, newValue: 'Save' },
			},
		]
		expect(events.map((event) => activityEventDataSchema.parse(event))).toEqual(events)
		expect(new Set(events.map((event) => event.type))).toEqual(new Set(Object.values(ACTIVITY_TYPE)))
	})

	it('rejects a payload of another type, an unknown type and empty field lists', () => {
		expect(activityEventDataSchema.safeParse({ type: ACTIVITY_TYPE.LANGUAGE_ADDED, payload: { name: 'B2B Admin' } }).success).toBe(false)
		expect(activityEventDataSchema.safeParse({ type: 'PROJECT_DELETED', payload: {} }).success).toBe(false)
		expect(activityEventDataSchema.safeParse({ type: ACTIVITY_TYPE.PROJECT_UPDATED, payload: { fields: [] } }).success).toBe(false)
		expect(activityEventDataSchema.safeParse({ type: ACTIVITY_TYPE.PROJECT_UPDATED, payload: { fields: ['baseLanguageId'] } }).success).toBe(false)
		expect(
			activityEventDataSchema.safeParse({ type: ACTIVITY_TYPE.KEY_UPDATED, payload: { keyId: KEY_ID, namespace: 'loc', name: 'a', fields: [] } }).success,
		).toBe(false)
	})

	it('rejects negative or fractional import counts', () => {
		const payload = { keysCreated: 0, translationsCreated: 1, translationsUpdated: 0, languageTags: [] }
		expect(activityEventDataSchema.safeParse({ type: ACTIVITY_TYPE.KEYS_IMPORTED, payload: { ...payload, keysCreated: -1 } }).success).toBe(false)
		expect(activityEventDataSchema.safeParse({ type: ACTIVITY_TYPE.KEYS_IMPORTED, payload: { ...payload, translationsCreated: 1.5 } }).success).toBe(false)
	})
})
