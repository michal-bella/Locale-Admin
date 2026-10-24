import { createRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { activityCategorySchema, activityRangeSchema } from '@locale/shared'

import { projectRoute } from '@/routes/projectRoute'

export const HISTORY_PAGE_SIZES = [20, 50] as const

export type HistoryPageSize = (typeof HISTORY_PAGE_SIZES)[number]

/** Filters of História in the URL, like Preklady: every field is optional, an invalid value is dropped. `period` is the last 7, 30 or 90 days with today. */
export const historySearchSchema = z.object({
	user: z.uuid().optional().catch(undefined),
	category: activityCategorySchema.optional().catch(undefined),
	version: z.uuid().optional().catch(undefined),
	period: activityRangeSchema.optional().catch(undefined),
	page: z.number().int().min(1).optional().catch(undefined),
	pageSize: z.literal(HISTORY_PAGE_SIZES).optional().catch(undefined),
})

export type HistorySearch = z.infer<typeof historySearchSchema>

export const projectHistoryRoute = createRoute({
	getParentRoute: () => projectRoute,
	path: '/history',
	validateSearch: historySearchSchema,
}).lazy(() => import('@/routes/projectHistoryRoute.lazy').then((module) => module.Route))
