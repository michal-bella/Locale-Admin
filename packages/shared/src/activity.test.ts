import { describe, expect, it } from 'vitest'

import {
	ACTIVITY_TYPE,
	activityDailyQuerySchema,
	activityDailyResponseSchema,
	activityEventDataSchema,
	activityListQuerySchema,
	activityListResponseSchema,
} from './activity'
import { toValidationIssues } from './errors'

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
			{ type: ACTIVITY_TYPE.KEY_CREATED, payload: { keyId: KEY_ID, namespace: 'loc', name: 'Uložiť', languageTags: ['sk'] } },
			{ type: ACTIVITY_TYPE.KEY_UPDATED, payload: { keyId: KEY_ID, namespace: 'loc', name: 'Uložiť', fields: ['description'] } },
			{
				type: ACTIVITY_TYPE.TRANSLATION_UPDATED,
				payload: { keyId: KEY_ID, namespace: '', name: 'Uložiť', languageTag: 'en', oldValue: null, newValue: 'Save' },
			},
			{ type: ACTIVITY_TYPE.VERSION_CREATED, payload: { name: 'v2.45', startsAt: '2026-09-08', endsAt: '2026-09-29' } },
			{ type: ACTIVITY_TYPE.VERSION_UPDATED, payload: { name: 'v2.45', fields: ['endsAt', 'lock'] } },
			{ type: ACTIVITY_TYPE.VERSION_DELETED, payload: { name: 'v2.44', keyCount: 2300 } },
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

describe('activityListQuerySchema', () => {
	it('defaults the limit, coerces it from the query string and treats an empty cursor as none', () => {
		expect(activityListQuerySchema.parse({})).toEqual({ limit: 20 })
		expect(activityListQuerySchema.parse({ cursor: '', limit: '50' })).toEqual({ limit: 50 })
		expect(activityListQuerySchema.parse({ cursor: KEY_ID, limit: '1' })).toEqual({ cursor: KEY_ID, limit: 1 })
	})

	it('rejects a limit out of 1–50 and a non-uuid cursor', () => {
		const issues = (query: object) => {
			const result = activityListQuerySchema.safeParse(query)
			return result.success ? [] : toValidationIssues(result.error)
		}
		// The shared mapper reports a minimum of 1 as REQUIRED.
		expect(issues({ limit: '0' })).toEqual([{ path: 'limit', code: 'REQUIRED' }])
		expect(issues({ limit: '51' })).toEqual([{ path: 'limit', code: 'TOO_LONG', params: { max: 50 } }])
		expect(issues({ cursor: 'abc' })).toEqual([{ path: 'cursor', code: 'INVALID' }])
	})
})

describe('activityListResponseSchema', () => {
	it('accepts an event with its payload, a deleted user and rejects a payload of another type', () => {
		const item = {
			id: KEY_ID,
			createdAt: '2026-10-20T08:00:00.000Z',
			count: 1,
			user: { id: KEY_ID, name: 'Jana' },
			version: null,
			type: ACTIVITY_TYPE.LANGUAGE_ADDED,
			payload: { tag: 'en' },
		}
		expect(activityListResponseSchema.parse({ items: [item, { ...item, user: null }], nextCursor: KEY_ID }).items).toEqual([item, { ...item, user: null }])
		expect(activityListResponseSchema.safeParse({ items: [{ ...item, payload: { name: 'A' } }], nextCursor: null }).success).toBe(false)
	})
})

describe('activityDailyQuerySchema', () => {
	it('defaults to 30 days in UTC', () => {
		expect(activityDailyQuerySchema.parse({})).toEqual({ range: '30d', timeZone: 'UTC' })
		expect(activityDailyQuerySchema.parse({ range: '', timeZone: '' })).toEqual({ range: '30d', timeZone: 'UTC' })
	})

	it('accepts the ranges and IANA zones', () => {
		expect(activityDailyQuerySchema.parse({ range: '7d', timeZone: 'Europe/Bratislava' })).toEqual({ range: '7d', timeZone: 'Europe/Bratislava' })
		expect(activityDailyQuerySchema.parse({ range: '90d', timeZone: 'America/Argentina/Buenos_Aires' }).range).toBe('90d')
	})

	it('rejects an unknown range, an unknown zone and an offset', () => {
		for (const query of [{ range: '1y' }, { timeZone: 'Europe/Nowhere' }, { timeZone: '+01:00' }, { timeZone: 'UTC+1' }]) {
			const result = activityDailyQuerySchema.safeParse(query)
			expect(result.success, JSON.stringify(query)).toBe(false)
			expect(result.error && toValidationIssues(result.error)).toEqual([{ path: Object.keys(query)[0], code: 'INVALID' }])
		}
	})
})

describe('activityDailyResponseSchema', () => {
	it('accepts days and contributors and rejects a contributor without changes', () => {
		const body = { days: [{ date: '2026-10-20', changes: 0 }], contributors: [{ user: { id: KEY_ID, name: 'Jana' }, changes: 3 }] }
		expect(activityDailyResponseSchema.parse(body)).toEqual(body)
		expect(activityDailyResponseSchema.safeParse({ ...body, contributors: [{ user: { id: KEY_ID, name: 'Jana' }, changes: 0 }] }).success).toBe(false)
		expect(activityDailyResponseSchema.safeParse({ ...body, days: [{ date: '20. 10. 2026', changes: 0 }] }).success).toBe(false)
	})
})
