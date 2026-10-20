import { z } from 'zod'

/** Languages an ADMIN can add. `flagCode` is an ISO 3166-1 country code, `en` uses the UK flag like the language switcher. */
export const SUPPORTED_LANGUAGES = [
	{ tag: 'bg', englishName: 'Bulgarian', nativeName: 'български', flagCode: 'bg' },
	{ tag: 'cs', englishName: 'Czech', nativeName: 'čeština', flagCode: 'cz' },
	{ tag: 'de-AT', englishName: 'German (Austria)', nativeName: 'Deutsch (Österreich)', flagCode: 'at' },
	{ tag: 'en', englishName: 'English', nativeName: 'English', flagCode: 'gb' },
	{ tag: 'hr', englishName: 'Croatian', nativeName: 'hrvatski', flagCode: 'hr' },
	{ tag: 'hu', englishName: 'Hungarian', nativeName: 'magyar', flagCode: 'hu' },
	{ tag: 'ro', englishName: 'Romanian', nativeName: 'română', flagCode: 'ro' },
	{ tag: 'ru', englishName: 'Russian', nativeName: 'русский', flagCode: 'ru' },
	{ tag: 'sk', englishName: 'Slovak', nativeName: 'slovenčina', flagCode: 'sk' },
] as const

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

export type LanguageTag = SupportedLanguage['tag']

export type LanguageFlagCode = SupportedLanguage['flagCode']

export const LANGUAGE_TAGS = SUPPORTED_LANGUAGES.map((language) => language.tag) as [LanguageTag, ...LanguageTag[]]

export const LANGUAGE_FLAG_CODES = [...new Set(SUPPORTED_LANGUAGES.map((language) => language.flagCode))] as [LanguageFlagCode, ...LanguageFlagCode[]]

/** One language of a project in `GET /api/projects/:projectId/languages` and the body of `201 POST`. Names and flag come from the catalog. */
export const languageSchema = z.object({
	id: z.uuid(),
	tag: z.enum(LANGUAGE_TAGS),
	englishName: z.string(),
	nativeName: z.string(),
	flagCode: z.enum(LANGUAGE_FLAG_CODES),
	isBase: z.boolean(),
	createdAt: z.iso.datetime(),
})

export type Language = z.infer<typeof languageSchema>

/**
 * One language in `GET /api/projects/:projectId/languages` and `PUT …/order`. `translatedCount` is the number of keys with a value in this
 * language, `keyCount` the number of keys of the project (the same in every item), so the language is fully translated when they are equal.
 */
export const languageListItemSchema = languageSchema.extend({
	translatedCount: z.number().int().nonnegative(),
	keyCount: z.number().int().nonnegative(),
})

export type LanguageListItem = z.infer<typeof languageListItemSchema>

/** Body of `GET /api/projects/:projectId/languages`, the base language first, then in the order set by drag and drop. */
export const languagesResponseSchema = z.array(languageListItemSchema)

export type LanguagesResponse = z.infer<typeof languagesResponseSchema>

/** Body of `POST /api/projects/:projectId/languages`. Names and flag come from `SUPPORTED_LANGUAGES`. */
export const createLanguageRequestSchema = z.object({
	tag: z.enum(LANGUAGE_TAGS),
})

export type CreateLanguageRequest = z.infer<typeof createLanguageRequestSchema>

/** Body of `PUT /api/projects/:projectId/languages/order`: every language of the project in the new order. The first one becomes the base. */
export const reorderLanguagesRequestSchema = z.object({
	languageIds: z
		.array(z.uuid())
		.min(1)
		.max(SUPPORTED_LANGUAGES.length)
		.refine((ids) => new Set(ids).size === ids.length),
})

export type ReorderLanguagesRequest = z.infer<typeof reorderLanguagesRequestSchema>
