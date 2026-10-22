import { describe, expect, it } from 'vitest'

import { toValidationIssues, VALIDATION_CODE } from './errors'
import {
	PROJECT_VERSION_NAME_MAX_LENGTH,
	VERSION_LOCK,
	createProjectVersionRequestSchema,
	daysUntil,
	getVersionState,
	isVersionLocked,
	toVersionDate,
	updateProjectVersionRequestSchema,
} from './projectVersions'

const issuesOf = (schema: typeof createProjectVersionRequestSchema | typeof updateProjectVersionRequestSchema, input: unknown) => {
	const result = schema.safeParse(input)
	return result.success ? [] : toValidationIssues(result.error)
}

describe('createProjectVersionRequestSchema', () => {
	it('trims the name and drops unknown fields', () => {
		expect(createProjectVersionRequestSchema.parse({ name: ' v2.45 ', startsAt: '2026-09-08', endsAt: '2026-09-29', lock: 'LOCKED' })).toEqual({
			name: 'v2.45',
			startsAt: '2026-09-08',
			endsAt: '2026-09-29',
		})
	})

	it('maps missing and invalid fields to shared codes', () => {
		expect(issuesOf(createProjectVersionRequestSchema, {})).toEqual([
			{ path: 'name', code: VALIDATION_CODE.REQUIRED },
			{ path: 'startsAt', code: VALIDATION_CODE.REQUIRED },
			{ path: 'endsAt', code: VALIDATION_CODE.REQUIRED },
		])
		expect(
			issuesOf(createProjectVersionRequestSchema, {
				name: 'x'.repeat(PROJECT_VERSION_NAME_MAX_LENGTH + 1),
				startsAt: '08/09/2026',
				endsAt: '2026-09-29',
			}),
		).toEqual([
			{ path: 'name', code: VALIDATION_CODE.TOO_LONG, params: { max: PROJECT_VERSION_NAME_MAX_LENGTH } },
			{ path: 'startsAt', code: VALIDATION_CODE.INVALID },
		])
	})

	it('requires endsAt after startsAt', () => {
		expect(issuesOf(createProjectVersionRequestSchema, { name: 'v1', startsAt: '2026-09-08', endsAt: '2026-09-08' })).toEqual([
			{ path: 'endsAt', code: VALIDATION_CODE.INVALID },
		])
		expect(issuesOf(createProjectVersionRequestSchema, { name: 'v1', startsAt: '2026-09-08', endsAt: '2026-09-07' })).toEqual([
			{ path: 'endsAt', code: VALIDATION_CODE.INVALID },
		])
		expect(createProjectVersionRequestSchema.safeParse({ name: 'v1', startsAt: '2026-09-08', endsAt: '2026-09-09' }).success).toBe(true)
	})
})

describe('updateProjectVersionRequestSchema', () => {
	it('needs at least one field and accepts a single one', () => {
		expect(updateProjectVersionRequestSchema.safeParse({}).success).toBe(false)
		expect(updateProjectVersionRequestSchema.parse({ lock: 'UNLOCKED' })).toEqual({ lock: VERSION_LOCK.UNLOCKED })
		expect(updateProjectVersionRequestSchema.parse({ endsAt: '2026-10-01' })).toEqual({ endsAt: '2026-10-01' })
	})

	it('rejects AUTO as a lock and checks the dates only when both are sent', () => {
		expect(issuesOf(updateProjectVersionRequestSchema, { lock: 'AUTO' })).toEqual([{ path: 'lock', code: VALIDATION_CODE.INVALID }])
		expect(issuesOf(updateProjectVersionRequestSchema, { startsAt: '2026-09-08', endsAt: '2026-09-01' })).toEqual([
			{ path: 'endsAt', code: VALIDATION_CODE.INVALID },
		])
	})
})

describe('version lock and state', () => {
	const version = { startsAt: '2026-09-08', endsAt: '2026-09-29' }

	it('AUTO locks outside the window (before startsAt and after endsAt), explicit locks win over the dates', () => {
		expect(isVersionLocked({ ...version, lock: VERSION_LOCK.AUTO }, '2026-09-07')).toBe(true)
		expect(isVersionLocked({ ...version, lock: VERSION_LOCK.AUTO }, '2026-09-08')).toBe(false)
		expect(isVersionLocked({ ...version, lock: VERSION_LOCK.AUTO }, '2026-09-29')).toBe(false)
		expect(isVersionLocked({ ...version, lock: VERSION_LOCK.AUTO }, '2026-09-30')).toBe(true)
		expect(isVersionLocked({ ...version, lock: VERSION_LOCK.UNLOCKED }, '2026-09-01')).toBe(false)
		expect(isVersionLocked({ ...version, lock: VERSION_LOCK.UNLOCKED }, '2026-12-01')).toBe(false)
		expect(isVersionLocked({ ...version, lock: VERSION_LOCK.LOCKED }, '2026-09-01')).toBe(true)
	})

	it('derives the state from the lock and startsAt; a version before its window is UPCOMING, not LOCKED', () => {
		expect(getVersionState({ ...version, lock: VERSION_LOCK.AUTO }, '2026-09-01')).toBe('UPCOMING')
		expect(getVersionState({ ...version, lock: VERSION_LOCK.UNLOCKED }, '2026-09-01')).toBe('UPCOMING')
		expect(getVersionState({ ...version, lock: VERSION_LOCK.AUTO }, '2026-09-08')).toBe('ACTIVE')
		expect(getVersionState({ ...version, lock: VERSION_LOCK.AUTO }, '2026-10-01')).toBe('LOCKED')
		expect(getVersionState({ ...version, lock: VERSION_LOCK.UNLOCKED }, '2026-10-01')).toBe('ACTIVE')
		expect(getVersionState({ ...version, lock: VERSION_LOCK.LOCKED }, '2026-09-01')).toBe('LOCKED')
	})

	it('formats local dates and counts whole days', () => {
		expect(toVersionDate(new Date(2026, 8, 8, 23, 59))).toBe('2026-09-08')
		expect(daysUntil('2026-09-29', '2026-09-17')).toBe(12)
		expect(daysUntil('2026-09-29', '2026-09-29')).toBe(0)
		expect(daysUntil('2026-09-29', '2026-10-02')).toBe(-3)
	})
})
