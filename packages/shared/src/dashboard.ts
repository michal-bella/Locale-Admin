import { z } from 'zod'

import { translationVersionRefSchema } from './versionRef'

const count = z.number().int().nonnegative()

const emptyToUndefined = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? undefined : value)

/** Query of `GET /api/projects/:projectId/dashboard`: the version to sum up; left out, the project's default version (current, else newest). */
export const dashboardQuerySchema = z.object({
	versionId: z.preprocess(emptyToUndefined, z.uuid().optional()),
})

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>

/**
 * Body of `GET /api/projects/:projectId/dashboard`, the numbers of one version (`version`, `null` for a project without versions: every count is 0).
 * `translatedKeys` have a value in every language of the project (0 without languages). `strings` are the cells (keys × languages) and
 * those with a value. `baseWords` counts the words (runs of non-whitespace) of the base language values. Languages and members come from their own endpoints.
 */
export const dashboardResponseSchema = z.object({
	version: translationVersionRefSchema.nullable(),
	keys: z.object({ total: count, createdLast30Days: count }),
	translatedKeys: count,
	strings: z.object({ filled: count, total: count }),
	baseWords: count,
})

export type DashboardResponse = z.infer<typeof dashboardResponseSchema>
