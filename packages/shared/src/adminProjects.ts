import { z } from 'zod'

import { LANGUAGE_TAGS } from './languages'

/** One project in `GET /api/admin/projects`. `baseLanguageTag` is `null` only for a project without languages. */
export const adminProjectListItemSchema = z.object({
	id: z.uuid(),
	name: z.string(),
	slug: z.string(),
	primaryColor: z.string(),
	baseLanguageTag: z.enum(LANGUAGE_TAGS).nullable(),
	languageCount: z.number().int().nonnegative(),
	memberCount: z.number().int().nonnegative(),
	createdAt: z.iso.datetime(),
})

export type AdminProjectListItem = z.infer<typeof adminProjectListItemSchema>

/** Body of `GET /api/admin/projects`, sorted by name. Every project, not only those the ADMIN is a member of. */
export const adminProjectListResponseSchema = z.object({
	projects: z.array(adminProjectListItemSchema),
})

export type AdminProjectListResponse = z.infer<typeof adminProjectListResponseSchema>
