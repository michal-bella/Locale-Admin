import { createRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { LANGUAGE_TAGS, TRANSLATIONS_SEARCH_MAX_LENGTH, translationsSortSchema, translationStatusSchema } from '@locale/shared'

import { projectRoute } from '@/routes/projectRoute'

/**
 * Filters of the translations list in the URL, so a reload or a shared link shows the same page. Languages are tags (`?source=sk&target=en`),
 * the page maps them to ids. Every field is optional and an invalid value is dropped, a missing one means the default.
 */
export const translationsSearchSchema = z.object({
	// The router JSON-parses search values, so `?search=123` arrives as a number.
	search: z.coerce.string().trim().max(TRANSLATIONS_SEARCH_MAX_LENGTH).optional().catch(undefined),
	status: translationStatusSchema.optional().catch(undefined),
	namespace: z.coerce.string().optional().catch(undefined),
	sort: translationsSortSchema.optional().catch(undefined),
	source: z.enum(LANGUAGE_TAGS).optional().catch(undefined),
	target: z.enum(LANGUAGE_TAGS).optional().catch(undefined),
	page: z.number().int().min(1).optional().catch(undefined),
})

export type TranslationsSearch = z.infer<typeof translationsSearchSchema>

export const projectTranslationsRoute = createRoute({
	getParentRoute: () => projectRoute,
	path: '/translations',
	validateSearch: translationsSearchSchema,
}).lazy(() => import('@/routes/projectTranslationsRoute.lazy').then((module) => module.Route))
