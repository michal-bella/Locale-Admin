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

/** Body of `GET /api/projects/:projectId/languages`, the base language first, then by tag. */
export const languagesResponseSchema = z.array(languageSchema)

export type LanguagesResponse = z.infer<typeof languagesResponseSchema>

/** Body of `POST /api/projects/:projectId/languages`. Names and flag come from `SUPPORTED_LANGUAGES`. */
export const createLanguageRequestSchema = z.object({
	tag: z.enum(LANGUAGE_TAGS),
})

export type CreateLanguageRequest = z.infer<typeof createLanguageRequestSchema>
