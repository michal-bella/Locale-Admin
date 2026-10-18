import { z } from 'zod'

export const PROJECT_NAME_MAX_LENGTH = 100

export const PROJECT_SLUG_MAX_LENGTH = 50

export const projectNameSchema = z.string().trim().min(1).max(PROJECT_NAME_MAX_LENGTH)

export type ProjectName = z.infer<typeof projectNameSchema>

/** Lowercase letters and digits in groups separated by single hyphens, e.g. `b2b-admin`. Used to name exported files. */
export const projectSlugSchema = z
	.string()
	.trim()
	.min(1)
	.max(PROJECT_SLUG_MAX_LENGTH)
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

export type ProjectSlug = z.infer<typeof projectSlugSchema>

/** `#RRGGBB`, stored and returned in uppercase. */
export const hexColorSchema = z
	.string()
	.trim()
	.regex(/^#[0-9a-fA-F]{6}$/)
	.transform((color) => color.toUpperCase())

export type HexColor = z.infer<typeof hexColorSchema>

/**
 * Body of `GET` and `PATCH /api/projects/:projectId/settings`.
 * `baseLanguageId` is the language with `isBase`, `null` when there are no languages.
 */
export const projectSettingsSchema = z.object({
	id: z.uuid(),
	name: z.string(),
	slug: z.string(),
	primaryColor: z.string(),
	protectVariables: z.boolean(),
	baseLanguageId: z.uuid().nullable(),
})

export type ProjectSettings = z.infer<typeof projectSettingsSchema>

/**
 * Body of `PATCH /api/projects/:projectId/settings`. The base language is still global, so only an ADMIN may send `baseLanguageId`;
 * it moves the base flag of languages in the same transaction.
 */
export const updateProjectSettingsRequestSchema = z.object({
	name: projectNameSchema,
	slug: projectSlugSchema,
	primaryColor: hexColorSchema,
	protectVariables: z.boolean(),
	baseLanguageId: z.uuid().optional(),
})

export type UpdateProjectSettingsRequest = z.infer<typeof updateProjectSettingsRequestSchema>
