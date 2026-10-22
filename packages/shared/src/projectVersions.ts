import { z } from 'zod'

import { VALIDATION_CODE } from './errors'
import { translationEditorSchema } from './translations'

export const PROJECT_VERSION_NAME_MAX_LENGTH = 50

/** Lock of a version (Prisma enum `VERSION_LOCK`): `AUTO` follows `endsAt`, the other two are set by an ADMIN and win over the dates. */
export enum VERSION_LOCK {
	AUTO = 'AUTO',
	LOCKED = 'LOCKED',
	UNLOCKED = 'UNLOCKED',
}

/** State of a version for today: `LOCKED` when `isLocked`, else `UPCOMING` before `startsAt`, else `ACTIVE` (also when unlocked after `endsAt`). */
export const projectVersionStateSchema = z.enum(['UPCOMING', 'ACTIVE', 'LOCKED'])

export type ProjectVersionState = z.infer<typeof projectVersionStateSchema>

/** A calendar day as `YYYY-MM-DD`; versions have no time of day. */
export const versionDateSchema = z.iso.date()

const nameSchema = z.string().trim().min(1).max(PROJECT_VERSION_NAME_MAX_LENGTH)

const endsAfterStarts = (value: { startsAt?: string; endsAt?: string }, context: z.RefinementCtx) => {
	if (value.startsAt !== undefined && value.endsAt !== undefined && value.endsAt <= value.startsAt) {
		// Reported with the shared `INVALID` code on `endsAt`, so the form can show it under the field.
		context.addIssue({ code: 'custom', path: ['endsAt'], message: 'endsAt must be after startsAt', params: { code: VALIDATION_CODE.INVALID } })
	}
}

/** Body of `POST /api/projects/:projectId/versions`. `endsAt` must be after `startsAt`; versions of a project may overlap. */
export const createProjectVersionRequestSchema = z
	.object({
		name: nameSchema,
		startsAt: versionDateSchema,
		endsAt: versionDateSchema,
	})
	.superRefine(endsAfterStarts)

export type CreateProjectVersionRequest = z.infer<typeof createProjectVersionRequestSchema>

export type CreateProjectVersionRequestInput = z.input<typeof createProjectVersionRequestSchema>

/** `lock` values an ADMIN can set by hand; `AUTO` is only the default of a new version. */
export const versionLockRequestSchema = z.enum([VERSION_LOCK.LOCKED, VERSION_LOCK.UNLOCKED])

/**
 * Body of `PATCH /api/projects/:projectId/versions/:versionId`: at least one field. When only one date is sent, the backend checks
 * `endsAt > startsAt` against the stored other date and reports it the same way (`endsAt` / `INVALID`).
 */
export const updateProjectVersionRequestSchema = z
	.object({
		name: nameSchema.optional(),
		startsAt: versionDateSchema.optional(),
		endsAt: versionDateSchema.optional(),
		lock: versionLockRequestSchema.optional(),
	})
	.refine((value) => Object.values(value).some((field) => field !== undefined), { message: 'At least one field is required' })
	.superRefine(endsAfterStarts)

export type UpdateProjectVersionRequest = z.infer<typeof updateProjectVersionRequestSchema>

export type UpdateProjectVersionRequestInput = z.input<typeof updateProjectVersionRequestSchema>

/**
 * One version in `GET /api/projects/:projectId/versions` and the body of `POST` and `PATCH`. `isLocked` is the effective lock for
 * today (`lock = LOCKED`, or `lock = AUTO` and today is past `endsAt`); `isCurrent` marks the version today falls into (the latest
 * `startsAt` when several overlap). `createdBy` is `null` after the user was deleted.
 */
export const projectVersionSchema = z.object({
	id: z.uuid(),
	name: z.string(),
	startsAt: versionDateSchema,
	endsAt: versionDateSchema,
	lock: z.enum(VERSION_LOCK),
	isLocked: z.boolean(),
	state: projectVersionStateSchema,
	isCurrent: z.boolean(),
	createdAt: z.iso.datetime(),
	createdBy: translationEditorSchema.nullable(),
})

export type ProjectVersion = z.infer<typeof projectVersionSchema>

/** Body of `GET /api/projects/:projectId/versions`, newest `startsAt` first. */
export const projectVersionsResponseSchema = z.object({
	items: z.array(projectVersionSchema),
})

export type ProjectVersionsResponse = z.infer<typeof projectVersionsResponseSchema>

/** `YYYY-MM-DD` of a date in the local calendar of the runtime (the server for the API, the browser for the countdown). */
export const toVersionDate = (date: Date): string => {
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	return `${date.getFullYear()}-${month}-${day}`
}

/** The effective lock: an explicit `lock` wins, `AUTO` locks the day after `endsAt`. Dates compare as `YYYY-MM-DD` strings. */
export const isVersionLocked = ({ lock, endsAt }: { lock: VERSION_LOCK; endsAt: string }, today: string): boolean =>
	lock === VERSION_LOCK.LOCKED || (lock === VERSION_LOCK.AUTO && today > endsAt)

export const getVersionState = (version: { lock: VERSION_LOCK; startsAt: string; endsAt: string }, today: string): ProjectVersionState =>
	isVersionLocked(version, today) ? 'LOCKED' : today < version.startsAt ? 'UPCOMING' : 'ACTIVE'

/** Days from `today` to `date` (negative when past), both `YYYY-MM-DD`; whole days, no time zone involved. */
export const daysUntil = (date: string, today: string): number => Math.round((Date.parse(date) - Date.parse(today)) / 86_400_000)
