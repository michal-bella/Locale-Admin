import { z } from 'zod'

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
	KEY_UPDATED = 'KEY_UPDATED',
	TRANSLATION_UPDATED = 'TRANSLATION_UPDATED',
}

/** Project settings whose change writes `PROJECT_UPDATED`. */
export const ACTIVITY_PROJECT_FIELDS = ['name', 'slug', 'primaryColor', 'protectVariables'] as const

export type ActivityProjectField = (typeof ACTIVITY_PROJECT_FIELDS)[number]

/** Key attributes whose change writes `KEY_UPDATED`. */
export const ACTIVITY_KEY_FIELDS = ['name', 'description', 'pluralVariable'] as const

export type ActivityKeyField = (typeof ACTIVITY_KEY_FIELDS)[number]

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
		translationsCreated: count,
		translationsUpdated: count,
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
])

export type ActivityEventData = z.infer<typeof activityEventDataSchema>
