import { z } from 'zod'

const count = z.number().int().nonnegative()

/**
 * Body of `GET /api/projects/:projectId/dashboard`. `translatedKeys` have a value in every language of the project (0 without
 * languages). `strings` are the cells (keys × languages) and those with a value. `baseWords` counts the words (runs of non-whitespace)
 * of the base language values. Languages and members come from their own endpoints.
 */
export const dashboardResponseSchema = z.object({
	keys: z.object({ total: count, createdLast30Days: count }),
	translatedKeys: count,
	strings: z.object({ filled: count, total: count }),
	baseWords: count,
})

export type DashboardResponse = z.infer<typeof dashboardResponseSchema>
