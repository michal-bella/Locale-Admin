import { createRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { LANGUAGE_TAGS, TRANSLATIONS_SEARCH_MAX_LENGTH, translationsSortSchema, translationStatusSchema, translationsUpdatedWithinSchema } from '@locale/shared'

import { projectRoute } from '@/routes/projectRoute'

/**
 * Filters of the translations list in the URL, so a reload or a shared link shows the same page. Languages are tags (`?source=sk&target=en`),
 * the page maps them to ids. Every field is optional and an invalid value is dropped, a missing one means the default.
 */
export const TRANSLATIONS_PAGE_SIZES = [25, 50, 100] as const

export type TranslationsPageSize = (typeof TRANSLATIONS_PAGE_SIZES)[number]

export const translationsSearchSchema = z.object({
	// The router JSON-parses search values, so `?search=123` arrives as a number.
	search: z.coerce.string().trim().max(TRANSLATIONS_SEARCH_MAX_LENGTH).optional().catch(undefined),
	status: translationStatusSchema.optional().catch(undefined),
	namespace: z.coerce.string().optional().catch(undefined),
	sort: translationsSortSchema.optional().catch(undefined),
	source: z.enum(LANGUAGE_TAGS).optional().catch(undefined),
	target: z.enum(LANGUAGE_TAGS).optional().catch(undefined),
	/** Languages the extended view shows next to the base language; none means every language. */
	languages: z.array(z.enum(LANGUAGE_TAGS)).min(1).optional().catch(undefined),
	updatedBy: z.uuid().optional().catch(undefined),
	updatedWithin: translationsUpdatedWithinSchema.optional().catch(undefined),
	/** Only keys with a placeholder warning (`?warnings=true`), turned on from the warnings banner. */
	warnings: z.literal(true).optional().catch(undefined),
	/** Work of one version (`ProjectVersion.id`); edits and new keys on the page go into it. */
	version: z.uuid().optional().catch(undefined),
	/** Hides the key and status columns. */
	translationsOnly: z.literal(true).optional().catch(undefined),
	page: z.number().int().min(1).optional().catch(undefined),
	pageSize: z.literal(TRANSLATIONS_PAGE_SIZES).optional().catch(undefined),
})

export type TranslationsSearch = z.infer<typeof translationsSearchSchema>

export const projectTranslationsRoute = createRoute({
	getParentRoute: () => projectRoute,
	path: '/translations',
	validateSearch: translationsSearchSchema,
}).lazy(() => import('@/routes/projectTranslationsRoute.lazy').then((module) => module.Route))
