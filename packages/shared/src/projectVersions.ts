import { z } from 'zod'

import { VALIDATION_CODE } from './errors'
import { translationEditorSchema } from './translations'
import { translationVersionRefSchema } from './versionRef'

export const PROJECT_VERSION_NAME_MAX_LENGTH = 50

/** Lock of a version (Prisma enum `VERSION_LOCK`): `AUTO` follows `endsAt`, the other two are set by an ADMIN and win over the dates. */
export enum VERSION_LOCK {
	AUTO = 'AUTO',
	LOCKED = 'LOCKED',
	UNLOCKED = 'UNLOCKED',
}

/** State of a version for today: `LOCKED` when locked by hand or past `endsAt` with `AUTO`, else `UPCOMING` before `startsAt`, else `ACTIVE` (also when unlocked after `endsAt`). */
export const projectVersionStateSchema = z.enum(['UPCOMING', 'ACTIVE', 'LOCKED'])

export type ProjectVersionState = z.infer<typeof projectVersionStateSchema>

/** A calendar day as `YYYY-MM-DD`; versions have no time of day. */
export const versionDateSchema = z.iso.date()

const nameSchema = z.string().trim().min(1).max(PROJECT_VERSION_NAME_MAX_LENGTH)

const endsAfterStarts = (value: { startsAt?: string; endsAt?: string }, context: z.RefinementCtx) => {
	if (value.startsAt !== undefined && value.endsAt !== undefined && value.endsAt <= value.startsAt) {
		// No `message`: zod would use it instead of the caller's error map, and the form wants its own text. The API reports it as `INVALID` on `endsAt`.
		context.addIssue({ code: 'custom', path: ['endsAt'], params: { code: VALIDATION_CODE.INVALID } })
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
 * today (`lock = LOCKED`, or `lock = AUTO` and today is outside `startsAt`–`endsAt`); `isCurrent` marks the version today falls into (the latest
 * `startsAt` when several overlap). `createdBy` is `null` after the user was deleted. `importedAt` is the last import, `null` for an
 * empty version; `keyCount` the keys the version holds.
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
	importedAt: z.iso.datetime().nullable(),
	keyCount: z.number().int().nonnegative(),
	createdAt: z.iso.datetime(),
	createdBy: translationEditorSchema.nullable(),
})

export type ProjectVersion = z.infer<typeof projectVersionSchema>

/** Body of `GET /api/projects/:projectId/versions`, newest `startsAt` first. */
export const projectVersionsResponseSchema = z.object({
	items: z.array(projectVersionSchema),
})

export type ProjectVersionsResponse = z.infer<typeof projectVersionsResponseSchema>

/**
 * Body of `GET /api/projects/:projectId/versions/:versionId/diff`: how the version differs from the nearest older one (`previousVersion`,
 * `null` for the first version: then every key is `added`). `removed` keys exist only in the previous version, so the list cannot show them.
 */
export const versionDiffSummarySchema = z.object({
	previousVersion: translationVersionRefSchema.nullable(),
	added: z.number().int().nonnegative(),
	changed: z.number().int().nonnegative(),
	removed: z.number().int().nonnegative(),
})

export type VersionDiffSummary = z.infer<typeof versionDiffSummarySchema>

/** `YYYY-MM-DD` of a date in the local calendar of the runtime (the server for the API, the browser for the countdown). */
export const toVersionDate = (date: Date): string => {
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	return `${date.getFullYear()}-${month}-${day}`
}

/**
 * The effective lock for an editor's writes: an explicit `lock` wins, `AUTO` locks outside the window (before `startsAt` and after
 * `endsAt`). Dates compare as `YYYY-MM-DD` strings.
 */
export const isVersionLocked = ({ lock, startsAt, endsAt }: { lock: VERSION_LOCK; startsAt: string; endsAt: string }, today: string): boolean =>
	lock === VERSION_LOCK.LOCKED || (lock === VERSION_LOCK.AUTO && (today < startsAt || today > endsAt))

/** A version before its window is `UPCOMING` even though editors cannot write into it yet; `LOCKED` is by hand or past `endsAt`. */
export const getVersionState = (version: { lock: VERSION_LOCK; startsAt: string; endsAt: string }, today: string): ProjectVersionState => {
	if (version.lock === VERSION_LOCK.LOCKED) {
		return 'LOCKED'
	}
	if (today < version.startsAt) {
		return 'UPCOMING'
	}
	return isVersionLocked(version, today) ? 'LOCKED' : 'ACTIVE'
}

/** Days from `today` to `date` (negative when past), both `YYYY-MM-DD`; whole days, no time zone involved. */
export const daysUntil = (date: string, today: string): number => Math.round((Date.parse(date) - Date.parse(today)) / 86_400_000)
