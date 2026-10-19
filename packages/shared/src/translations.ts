import { z } from 'zod'

export const TRANSLATIONS_PAGE_SIZE_DEFAULT = 50

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

/** `UNTRANSLATED_FIRST` orders by status, group, key; `KEY` by namespace, group, key; `UPDATED` by target `updatedAt`, newest first. */
export const translationsSortSchema = z.enum(['UNTRANSLATED_FIRST', 'KEY', 'UPDATED'])

export type TranslationsSort = z.infer<typeof translationsSortSchema>

const emptyToUndefined = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? undefined : value)

/**
 * Query of `GET /api/projects/:projectId/translations`. Values arrive as strings, so numbers are coerced and empty
 * strings mean "no filter". `search` matches the key and the source or target value (case-insensitive substring).
 */
export const translationsQuerySchema = z.object({
	sourceLanguageId: z.uuid(),
	targetLanguageId: z.uuid(),
	search: z.preprocess(emptyToUndefined, z.string().trim().max(TRANSLATIONS_SEARCH_MAX_LENGTH).optional()),
	status: z.preprocess(emptyToUndefined, translationStatusSchema.optional()),
	namespace: z.preprocess(emptyToUndefined, z.string().optional()),
	sort: z.preprocess(emptyToUndefined, translationsSortSchema.default('UNTRANSLATED_FIRST')),
	page: z.coerce.number().int().min(1).default(1),
	pageSize: z.coerce.number().int().min(1).max(TRANSLATIONS_PAGE_SIZE_MAX).default(TRANSLATIONS_PAGE_SIZE_DEFAULT),
})

export type TranslationsQuery = z.infer<typeof translationsQuerySchema>

export type TranslationsQueryInput = z.input<typeof translationsQuerySchema>

/**
 * One key with its source and target text. `group` is the namespace, plus `:prefix` for a path key
 * (`loc:orders.empty` for `orders.empty.title` in `loc`). `target.updatedAt` is `null` when the row does not exist.
 */
export const translationListItemSchema = z.object({
	keyId: z.uuid(),
	namespace: z.string(),
	name: z.string(),
	group: z.string(),
	source: z.object({ value: z.string().nullable() }),
	target: z.object({
		value: z.string().nullable(),
		status: translationStatusSchema,
		updatedAt: z.iso.datetime().nullable(),
	}),
})

export type TranslationListItem = z.infer<typeof translationListItemSchema>

/**
 * Body of `GET /api/projects/:projectId/translations`. `total` counts keys matching the filters; `stats` count every key
 * of the project in the target language, ignoring filters. `namespaces` lists every namespace of the project, sorted.
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
	}),
	namespaces: z.array(z.string()),
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
export const updateTranslationRequestSchema = z.object({
	value: z
		.string()
		.max(TRANSLATION_VALUE_MAX_LENGTH)
		.nullable()
		.transform((value) => (value === null || value.trim() === '' ? null : value)),
})

export type UpdateTranslationRequest = z.infer<typeof updateTranslationRequestSchema>

export type UpdateTranslationRequestInput = z.input<typeof updateTranslationRequestSchema>

/** Body of `200 PUT …/translations/:languageId`: the saved target cell, same shape as in the list. */
export const updateTranslationResponseSchema = z.object({
	value: z.string().nullable(),
	status: translationStatusSchema,
	updatedAt: z.iso.datetime(),
})

export type UpdateTranslationResponse = z.infer<typeof updateTranslationResponseSchema>

/** `details` of 400 `PLACEHOLDER_MISMATCH`: placeholders of the base language missing in or extra to the value. */
export const placeholderMismatchDetailsSchema = z.object({
	missing: z.array(z.string()),
	extra: z.array(z.string()),
})

export type PlaceholderMismatchDetails = z.infer<typeof placeholderMismatchDetailsSchema>
