import { z } from 'zod'

import { translationEditorSchema } from './translations'

/** Type of an `ActivityEvent` row (Prisma enum `ACTIVITY_TYPE`). */
export enum ACTIVITY_TYPE {
	PROJECT_CREATED = 'PROJECT_CREATED',
	PROJECT_UPDATED = 'PROJECT_UPDATED',
	LANGUAGE_ADDED = 'LANGUAGE_ADDED',
	LANGUAGE_REMOVED = 'LANGUAGE_REMOVED',
	BASE_LANGUAGE_CHANGED = 'BASE_LANGUAGE_CHANGED',
	MEMBER_ADDED = 'MEMBER_ADDED',
	MEMBER_REMOVED = 'MEMBER_REMOVED',
	KEYS_IMPORTED = 'KEYS_IMPORTED',
	KEY_CREATED = 'KEY_CREATED',
	KEY_UPDATED = 'KEY_UPDATED',
	TRANSLATION_UPDATED = 'TRANSLATION_UPDATED',
	VERSION_CREATED = 'VERSION_CREATED',
	VERSION_UPDATED = 'VERSION_UPDATED',
}

/** Project settings whose change writes `PROJECT_UPDATED`. */
export const ACTIVITY_PROJECT_FIELDS = ['name', 'slug', 'primaryColor', 'protectVariables'] as const

export type ActivityProjectField = (typeof ACTIVITY_PROJECT_FIELDS)[number]

/** Key attributes whose change writes `KEY_UPDATED`. */
export const ACTIVITY_KEY_FIELDS = ['name', 'description', 'pluralVariable'] as const

export type ActivityKeyField = (typeof ACTIVITY_KEY_FIELDS)[number]

/** Version attributes whose change writes `VERSION_UPDATED`. */
export const ACTIVITY_VERSION_FIELDS = ['name', 'startsAt', 'endsAt', 'lock'] as const

export type ActivityVersionField = (typeof ACTIVITY_VERSION_FIELDS)[number]

// A plain string, not the catalog enum: stored events must stay valid if a tag is ever removed from SUPPORTED_LANGUAGES.
const languageTag = z.string().min(1)

const count = z.number().int().nonnegative()

/** The user as they were at the time of the change, so the feed stays readable after the user is deleted. */
export const activityMemberSchema = z.object({
	id: z.uuid(),
	firstName: z.string().nullable(),
	lastName: z.string().nullable(),
	email: z.string(),
})

export type ActivityMember = z.infer<typeof activityMemberSchema>

const event = <T extends ACTIVITY_TYPE, P extends z.ZodRawShape>(type: T, payload: P) => z.object({ type: z.literal(type), payload: z.object(payload) })

/**
 * `type` and `payload` of an `ActivityEvent`. The payload is a snapshot (tags, key namespace and name, member, values), so the feed
 * stays readable after a key, language or user is deleted.
 */
export const activityEventDataSchema = z.discriminatedUnion('type', [
	event(ACTIVITY_TYPE.PROJECT_CREATED, { name: z.string() }),
	event(ACTIVITY_TYPE.PROJECT_UPDATED, { fields: z.array(z.enum(ACTIVITY_PROJECT_FIELDS)).min(1) }),
	event(ACTIVITY_TYPE.LANGUAGE_ADDED, { tag: languageTag }),
	event(ACTIVITY_TYPE.LANGUAGE_REMOVED, { tag: languageTag }),
	event(ACTIVITY_TYPE.BASE_LANGUAGE_CHANGED, { fromTag: languageTag.nullable(), toTag: languageTag }),
	event(ACTIVITY_TYPE.MEMBER_ADDED, { member: activityMemberSchema }),
	event(ACTIVITY_TYPE.MEMBER_REMOVED, { member: activityMemberSchema, left: z.boolean() }),
	event(ACTIVITY_TYPE.KEYS_IMPORTED, {
		keysCreated: count,
		keysCopied: count.optional(),
		keysRemoved: count.optional(),
		translationsCreated: count,
		translationsUpdated: count,
		languageTags: z.array(languageTag),
		versionName: z.string().optional(),
	}),
	event(ACTIVITY_TYPE.KEY_CREATED, {
		keyId: z.uuid(),
		namespace: z.string(),
		name: z.string(),
		languageTags: z.array(languageTag),
	}),
	event(ACTIVITY_TYPE.KEY_UPDATED, {
		keyId: z.uuid(),
		namespace: z.string(),
		name: z.string(),
		fields: z.array(z.enum(ACTIVITY_KEY_FIELDS)).min(1),
	}),
	event(ACTIVITY_TYPE.TRANSLATION_UPDATED, {
		keyId: z.uuid(),
		namespace: z.string(),
		name: z.string(),
		languageTag,
		oldValue: z.string().nullable(),
		newValue: z.string().nullable(),
	}),
	event(ACTIVITY_TYPE.VERSION_CREATED, { name: z.string(), startsAt: z.iso.date(), endsAt: z.iso.date() }),
	event(ACTIVITY_TYPE.VERSION_UPDATED, { name: z.string(), fields: z.array(z.enum(ACTIVITY_VERSION_FIELDS)).min(1) }),
])

export type ActivityEventData = z.infer<typeof activityEventDataSchema>

/** One event of the feed. `user` is who made the change, `null` after the user was deleted (the payload keeps the snapshot). */
export const activityEventSchema = z
	.object({
		id: z.uuid(),
		createdAt: z.iso.datetime(),
		count,
		user: translationEditorSchema.nullable(),
	})
	.and(activityEventDataSchema)

export type ActivityEvent = z.infer<typeof activityEventSchema>

export const ACTIVITY_PAGE_SIZE_DEFAULT = 20

export const ACTIVITY_PAGE_SIZE_MAX = 50

const emptyToUndefined = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? undefined : value)

/**
 * Query of `GET /api/projects/:projectId/activity`, newest first. `cursor` is the `id` of the last event of the previous page;
 * an id that is not an event of the project gives 400 `VALIDATION_ERROR` on `cursor`.
 */
export const activityListQuerySchema = z.object({
	cursor: z.preprocess(emptyToUndefined, z.uuid().optional()),
	limit: z.coerce.number().int().min(1).max(ACTIVITY_PAGE_SIZE_MAX).default(ACTIVITY_PAGE_SIZE_DEFAULT),
})

export type ActivityListQuery = z.infer<typeof activityListQuerySchema>

export type ActivityListQueryInput = z.input<typeof activityListQuerySchema>

/** Body of `GET /api/projects/:projectId/activity`; `nextCursor` is `null` on the last page. */
export const activityListResponseSchema = z.object({
	items: z.array(activityEventSchema),
	nextCursor: z.uuid().nullable(),
})

export type ActivityListResponse = z.infer<typeof activityListResponseSchema>

export const ACTIVITY_RANGES = ['7d', '30d', '90d'] as const

export const activityRangeSchema = z.enum(ACTIVITY_RANGES)

export type ActivityRange = z.infer<typeof activityRangeSchema>

export const ACTIVITY_RANGE_DAYS: Record<ActivityRange, number> = { '7d': 7, '30d': 30, '90d': 90 }

/** Number of members `GET …/activity/daily` lists. */
export const ACTIVITY_CONTRIBUTORS_MAX = 5

/**
 * An IANA zone name the runtime knows. `Intl.supportedValuesOf('timeZone')` is not used: it leaves out `UTC` in V8.
 * Offsets (`+01:00`) pass `Intl` but PostgreSQL reads them as POSIX zones with the sign flipped, so a name must start with a letter.
 */
const isTimeZone = (timeZone: string): boolean => {
	if (!/^[A-Za-z]/.test(timeZone)) {
		return false
	}
	try {
		new Intl.DateTimeFormat('en', { timeZone })
		return true
	} catch {
		return false
	}
}

/** Query of `GET /api/projects/:projectId/activity/daily`; the days are calendar days in `timeZone` (the browser zone). */
export const activityDailyQuerySchema = z.object({
	range: z.preprocess(emptyToUndefined, activityRangeSchema.default('30d')),
	timeZone: z.preprocess(emptyToUndefined, z.string().max(100).refine(isTimeZone).default('UTC')),
})

export type ActivityDailyQuery = z.infer<typeof activityDailyQuerySchema>

export type ActivityDailyQueryInput = z.input<typeof activityDailyQuerySchema>

/**
 * Body of `GET /api/projects/:projectId/activity/daily`. `days` has one entry per day of the range, oldest first, ending today
 * in the zone; `changes` is the sum of `count` (an import of 90 translations is 90). `contributors` are the members with the most
 * changes in the range (at most `ACTIVITY_CONTRIBUTORS_MAX`, ties by name), without deleted users.
 */
export const activityDailyResponseSchema = z.object({
	days: z.array(z.object({ date: z.iso.date(), changes: count })),
	contributors: z.array(z.object({ user: translationEditorSchema, changes: z.number().int().positive() })),
})

export type ActivityDailyResponse = z.infer<typeof activityDailyResponseSchema>
