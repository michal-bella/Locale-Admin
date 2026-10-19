import { z } from 'zod'

import { IMPORT_KEY_MAX_BYTES } from './imports'
import { PLURAL_VARIABLE_DEFAULT, PLURAL_VARIABLE_MAX_LENGTH, PLURAL_VARIABLE_PATTERN } from './plurals'

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

/**
 * One key with its source and target text. `group` is the namespace, plus `:prefix` for a path key
 * (`loc:orders.empty` for `orders.empty.title` in `loc`). `target.updatedAt` is `null` when the row does not exist.
 */
export const translationListItemSchema = z.object({
	keyId: z.uuid(),
	namespace: z.string(),
	name: z.string(),
	group: z.string(),
	description: z.string().nullable(),
	plural: translationKeyPluralSchema.nullable(),
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
