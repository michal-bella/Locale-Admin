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

export const LANGUAGE_NAME_MAX_LENGTH = 100

export const languageNameSchema = z.string().trim().min(1).max(LANGUAGE_NAME_MAX_LENGTH)

export type LanguageName = z.infer<typeof languageNameSchema>

/** One language in `GET /api/admin/languages` and the body of `POST` and `PATCH`. */
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

/** Body of `GET /api/admin/languages`, the base language first, then by tag. */
export const languagesResponseSchema = z.array(languageSchema)

export type LanguagesResponse = z.infer<typeof languagesResponseSchema>

/** Body of `POST /api/admin/languages`. Names and flag come from `SUPPORTED_LANGUAGES`. */
export const createLanguageRequestSchema = z.object({
	tag: z.enum(LANGUAGE_TAGS),
})

export type CreateLanguageRequest = z.infer<typeof createLanguageRequestSchema>

/**
 * Body of `PATCH /api/admin/languages/:id`. The tag is not editable, zod strips it.
 * `isBase` can only be turned on: the previous base language loses the flag in the same transaction.
 */
export const updateLanguageRequestSchema = z.object({
	englishName: languageNameSchema,
	nativeName: languageNameSchema,
	flagCode: z.enum(LANGUAGE_FLAG_CODES),
	isBase: z.literal(true).optional(),
})

export type UpdateLanguageRequest = z.infer<typeof updateLanguageRequestSchema>
