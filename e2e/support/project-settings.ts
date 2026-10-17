import { type APIRequestContext, expect } from '@playwright/test'

import { MUTATION_HEADERS } from './api'

export type ProjectSettings = {
	id: string
	name: string
	slug: string
	primaryColor: string
	protectVariables: boolean
	baseLanguageId: string | null
}

export const PROJECT_API = '/api/admin/project'

export const getProjectSettings = async (api: APIRequestContext) => {
	const response = await api.get(PROJECT_API)
	expect(response.status(), `GET ${PROJECT_API}`).toBe(200)
	return (await response.json()) as ProjectSettings
}

/** Writes `settings` back (the base language moves with `baseLanguageId`). Call it only while holding `acquireLanguagesLock()`. */
export const restoreProjectSettings = async (api: APIRequestContext, { name, slug, primaryColor, protectVariables, baseLanguageId }: ProjectSettings) => {
	const response = await api.patch(PROJECT_API, { data: { name, slug, primaryColor, protectVariables, baseLanguageId }, headers: MUTATION_HEADERS })
	expect(response.status(), `PATCH ${PROJECT_API}`).toBe(200)
}
