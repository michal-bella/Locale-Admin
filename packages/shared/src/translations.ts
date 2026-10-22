import { z } from 'zod'

import { IMPORT_KEY_MAX_BYTES, IMPORT_NAMESPACE_MAX_LENGTH } from './imports'
import { PLURAL_VARIABLE_DEFAULT, PLURAL_VARIABLE_MAX_LENGTH, PLURAL_VARIABLE_PATTERN } from './plurals'

export const TRANSLATIONS_PAGE_SIZE_DEFAULT = 20

export const TRANSLATIONS_PAGE_SIZE_MAX = 100

export const TRANSLATIONS_SEARCH_MAX_LENGTH = 200

/**
 * A key that looks like an object path (`orders.empty.title`) is grouped by its prefix (`orders.empty`).
 * Keys with spaces are sentences (`Adresa nie je kompletná. Uistite sa`) and are never split on dots.
 * The backend uses the same pattern in SQL (POSIX regex, no flags).
 */
export const TRANSLATION_KEY_PATH_PATTERN = '^[A-Za-z0-9_-]+(\\.[A-Za-z0-9_-]+)+$'

/** Derived from the value, never stored: a missing row or `null` value is `UNTRANSLATED`. */
export const translationStatusSchema = z.enum(['TRANSLATED', 'UNTRANSLATED'])

export type TranslationStatus = z.infer<typeof translationStatusSchema>

/**
 * `UNTRANSLATED_FIRST` orders by the row status, group, key; `KEY` by namespace, group, key; `UPDATED` by the newest `updatedAt`
 * of the row, newest first. Which languages count is decided by the query (see `translationsQuerySchema`).
 */
export const translationsSortSchema = z.enum(['UNTRANSLATED_FIRST', 'KEY', 'UPDATED'])

export type TranslationsSort = z.infer<typeof translationsSortSchema>

/** How the translations page shows the languages; stored on the user (`User.translationsView`). */
export const translationsViewSchema = z.enum(['EXTENDED', 'COMPACT'])

export type TranslationsView = z.infer<typeof translationsViewSchema>

/** Whether the languages of the view sit side by side or stacked in one column; stored on the user (`User.translationsLayout`). */
export const translationsLayoutSchema = z.enum(['COLUMNS', 'STACKED'])

export type TranslationsLayout = z.infer<typeof translationsLayoutSchema>

/** How far back `updatedWithin` reaches: the last 24 hours, 7 days or 30 days. */
export const translationsUpdatedWithinSchema = z.enum(['DAY', 'WEEK', 'MONTH'])

export type TranslationsUpdatedWithin = z.infer<typeof translationsUpdatedWithinSchema>

const emptyToUndefined = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? undefined : value)

/**
 * Query of `GET /api/projects/:projectId/translations`. Values arrive as strings, so numbers are coerced and empty
 * strings mean "no filter". With `sourceLanguageId` and `targetLanguageId` (both or none) the row status, the `status`
 * filter, the sort and `stats` follow the target language and `search` matches the key, the source and the target
 * value (compact view). Without them a row is translated only when every language of the project has a value, and
 * `search` matches the key and the value of any language (extended view). The items carry every language either way.
 * `updatedById` and `updatedWithin` keep keys with a translation (the target, or any language) changed by that user and in
 * that period, both on the same translation.
 */
export const translationsQuerySchema = z
	.object({
		sourceLanguageId: z.preprocess(emptyToUndefined, z.uuid().optional()),
		targetLanguageId: z.preprocess(emptyToUndefined, z.uuid().optional()),
		search: z.preprocess(emptyToUndefined, z.string().trim().max(TRANSLATIONS_SEARCH_MAX_LENGTH).optional()),
		status: z.preprocess(emptyToUndefined, translationStatusSchema.optional()),
		namespace: z.preprocess(emptyToUndefined, z.string().optional()),
		updatedById: z.preprocess(emptyToUndefined, z.uuid().optional()),
		updatedWithin: z.preprocess(emptyToUndefined, translationsUpdatedWithinSchema.optional()),
		/** `true` (also `'true'` or `'1'` in the URL) lists only keys with a cell whose placeholders differ from the base language. */
		warnings: z.preprocess((value) => (value === true || value === 'true' || value === '1' ? true : undefined), z.literal(true).optional()),
		/** The version whose keys are listed; every version holds its own copy of the keys (see `ProjectVersion`). */
		versionId: z.preprocess(emptyToUndefined, z.uuid()),
		sort: z.preprocess(emptyToUndefined, translationsSortSchema.default('UNTRANSLATED_FIRST')),
		page: z.coerce.number().int().min(1).default(1),
		pageSize: z.coerce.number().int().min(1).max(TRANSLATIONS_PAGE_SIZE_MAX).default(TRANSLATIONS_PAGE_SIZE_DEFAULT),
	})
	.superRefine((query, context) => {
		const [missing, ...rest] = (['sourceLanguageId', 'targetLanguageId'] as const).filter((field) => query[field] === undefined)
		if (missing && rest.length === 0) {
			// Reported as a missing field (`REQUIRED`), not as a cross-field rule the client cannot translate.
			context.addIssue({ code: 'invalid_type', expected: 'string', input: undefined, path: [missing], message: 'Both languages or none' })
		}
	})

export type TranslationsQuery = z.infer<typeof translationsQuerySchema>

export type TranslationsQueryInput = z.input<typeof translationsQuerySchema>

export const TRANSLATION_KEY_DESCRIPTION_MAX_LENGTH = 500

/** A plural key stores one ICU plural message per language (`serializePluralValue`); `variable` is its number variable. */
export const translationKeyPluralSchema = z.object({
	variable: z.string().trim().min(1).max(PLURAL_VARIABLE_MAX_LENGTH).regex(PLURAL_VARIABLE_PATTERN).default(PLURAL_VARIABLE_DEFAULT),
})

export type TranslationKeyPlural = z.infer<typeof translationKeyPluralSchema>

/** UTF-8 length without `TextEncoder`, which the shared tsconfig has no DOM lib for. */
const utf8ByteLength = (text: string): number => {
	let bytes = 0
	for (const char of text) {
		const code = char.codePointAt(0) ?? 0
		bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4
	}
	return bytes
}

/** Name of a key: trimmed, never empty, at most `IMPORT_KEY_MAX_BYTES` UTF-8 bytes (the unique index limit). */
export const translationKeyNameSchema = z
	.string()
	.trim()
	.min(1)
	.refine((name) => utf8ByteLength(name) <= IMPORT_KEY_MAX_BYTES, { params: { max: IMPORT_KEY_MAX_BYTES } })

/**
 * Body of `PATCH /api/projects/:projectId/keys/:keyId` (global ADMIN only). Every field is optional, at least one is required.
 * `plural: null` turns plural forms off (the `other` form stays as the value), an object turns them on (the current value becomes
 * the `other` form) or renames the variable. Renaming to a name used in the same namespace gives 409 `TRANSLATION_KEY_TAKEN`.
 */
export const updateTranslationKeyRequestSchema = z
	.object({
		name: translationKeyNameSchema.optional(),
		description: z.string().trim().max(TRANSLATION_KEY_DESCRIPTION_MAX_LENGTH).nullable().optional(),
		plural: translationKeyPluralSchema.nullable().optional(),
	})
	.refine((body) => body.name !== undefined || body.description !== undefined || body.plural !== undefined)

export type UpdateTranslationKeyRequest = z.infer<typeof updateTranslationKeyRequestSchema>

export type UpdateTranslationKeyRequestInput = z.input<typeof updateTranslationKeyRequestSchema>

/** Body of `200 PATCH …/keys/:keyId`: the key as in the list, without translations. */
export const updateTranslationKeyResponseSchema = z.object({
	keyId: z.uuid(),
	namespace: z.string(),
	name: z.string(),
	group: z.string(),
	description: z.string().nullable(),
	plural: translationKeyPluralSchema.nullable(),
})

export type UpdateTranslationKeyResponse = z.infer<typeof updateTranslationKeyResponseSchema>

/** Who saved a cell last (edit or import); `name` is the full name, or the e-mail when the user has none. */
export const translationEditorSchema = z.object({
	id: z.uuid(),
	name: z.string(),
})

export type TranslationEditor = z.infer<typeof translationEditorSchema>

/** One key in one language; `updatedAt` is `null` when the row does not exist, `updatedBy` also when the user was deleted. */
export const translationCellSchema = z.object({
	value: z.string().nullable(),
	status: translationStatusSchema,
	updatedAt: z.iso.datetime().nullable(),
	updatedBy: translationEditorSchema.nullable(),
})

export type TranslationCell = z.infer<typeof translationCellSchema>

/**
 * One key with a cell for every language of the project, keyed by `ProjectLanguage.id`. `group` is the namespace, plus
 * `:prefix` for a path key (`loc:orders.empty` for `orders.empty.title` in `loc`). `status` is the status of the row as
 * the query defines it (target language, or every language).
 */
export const translationListItemSchema = z.object({
	keyId: z.uuid(),
	namespace: z.string(),
	name: z.string(),
	group: z.string(),
	description: z.string().nullable(),
	plural: translationKeyPluralSchema.nullable(),
	status: translationStatusSchema,
	translations: z.record(z.uuid(), translationCellSchema),
})

export type TranslationListItem = z.infer<typeof translationListItemSchema>

/**
 * Body of `GET /api/projects/:projectId/translations`. `total` counts keys matching the filters; `stats` count every key
 * of the project by the row status of the query (target language, or every language), ignoring filters; `stats.warnings` counts keys with a
 * placeholder warning the same way. `namespaces`
 * lists every namespace of the project, sorted. `editors` lists every member of the project and every other user who changed one of its translations, most translations last edited by them first, then by name.
 */
export const translationsResponseSchema = z.object({
	items: z.array(translationListItemSchema),
	total: z.number().int().nonnegative(),
	page: z.number().int().min(1),
	pageSize: z.number().int().min(1),
	stats: z.object({
		totalKeys: z.number().int().nonnegative(),
		translated: z.number().int().nonnegative(),
		untranslated: z.number().int().nonnegative(),
		/** Keys with at least one cell whose placeholders differ from the base language (`Translation.placeholderWarning`), ignoring filters. */
		warnings: z.number().int().nonnegative(),
	}),
	namespaces: z.array(z.string()),
	editors: z.array(translationEditorSchema),
})

export type TranslationsResponse = z.infer<typeof translationsResponseSchema>

/** Group of a key; the backend computes the same in SQL. */
export const translationGroup = (namespace: string, name: string): string => {
	if (!new RegExp(TRANSLATION_KEY_PATH_PATTERN).test(name)) {
		return namespace
	}
	const prefix = name.slice(0, name.lastIndexOf('.'))
	return namespace === '' ? prefix : `${namespace}:${prefix}`
}

export const TRANSLATION_VALUE_MAX_LENGTH = 10_000

/**
 * Body of `PUT /api/projects/:projectId/keys/:keyId/translations/:languageId`. An empty or whitespace-only
 * value is stored as `null` (untranslated); `""` never reaches the database.
 */
const translationValueSchema = z
	.string()
	.max(TRANSLATION_VALUE_MAX_LENGTH)
	.nullable()
	.transform((value) => (value === null || value.trim() === '' ? null : value))

/** `versionId`: the version the change belongs to (the one filtered on the page); left out, the backend uses the current version by date. */
export const updateTranslationRequestSchema = z.object({
	value: translationValueSchema,
})

export type UpdateTranslationRequest = z.infer<typeof updateTranslationRequestSchema>

export type UpdateTranslationRequestInput = z.input<typeof updateTranslationRequestSchema>

/** Body of `200 PUT …/translations/:languageId`: the saved target cell, same shape as in the list. */
export const updateTranslationResponseSchema = z.object({
	value: z.string().nullable(),
	status: translationStatusSchema,
	updatedAt: z.iso.datetime(),
	updatedBy: translationEditorSchema.nullable(),
})

export type UpdateTranslationResponse = z.infer<typeof updateTranslationResponseSchema>

/**
 * Body of `POST /api/projects/:projectId/keys` (global ADMIN only): a key added by hand, e.g. one that came up in development after the
 * sheet was locked. `namespace` must be one the project already has (400 `VALIDATION_ERROR` on `namespace` otherwise). `translations` maps
 * `ProjectLanguage.id` to a value; an empty value or a language left out stays untranslated. A name taken in the namespace gives 409
 * `TRANSLATION_KEY_TAKEN`.
 */
export const createTranslationKeyRequestSchema = z.object({
	namespace: z.string().max(IMPORT_NAMESPACE_MAX_LENGTH),
	name: translationKeyNameSchema,
	translations: z.record(z.uuid(), translationValueSchema).default({}),
	/** The version the key is created in (the version must already have an import). */
	versionId: z.uuid(),
})

export type CreateTranslationKeyRequest = z.infer<typeof createTranslationKeyRequestSchema>

export type CreateTranslationKeyRequestInput = z.input<typeof createTranslationKeyRequestSchema>

/** Body of `201 POST …/keys`: the new key as in the list, without translations. */
export const createTranslationKeyResponseSchema = updateTranslationKeyResponseSchema

export type CreateTranslationKeyResponse = z.infer<typeof createTranslationKeyResponseSchema>

/**
 * `details` of 400 `PLACEHOLDER_MISMATCH`: placeholders of the base language missing in or extra to the value. `POST …/keys` adds the
 * `languageId` whose value differs, since it saves several languages at once.
 */
export const placeholderMismatchDetailsSchema = z.object({
	missing: z.array(z.string()),
	extra: z.array(z.string()),
	languageId: z.uuid().optional(),
})

export type PlaceholderMismatchDetails = z.infer<typeof placeholderMismatchDetailsSchema>
