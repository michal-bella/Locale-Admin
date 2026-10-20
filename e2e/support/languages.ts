import { type APIRequest, type APIRequestContext, expect } from '@playwright/test'

import { MUTATION_HEADERS } from './api'
import { STORAGE_STATE } from './auth'
import { BASE_URL } from './env'

export type Language = { id: string; tag: string; englishName: string; nativeName: string; flagCode: string; isBase: boolean; createdAt: string }

export const projectLanguagesApi = (projectId: string) => `/api/projects/${projectId}/languages`

export const newAdminApi = (request: APIRequest) => request.newContext({ baseURL: BASE_URL, storageState: STORAGE_STATE.ADMIN })

export const listLanguages = async (api: APIRequestContext, projectId: string) => {
	const response = await api.get(projectLanguagesApi(projectId))
	expect(response.status(), `GET ${projectLanguagesApi(projectId)}`).toBe(200)
	return (await response.json()) as Language[]
}

/** Sets the project order of the languages by tag; the first one becomes the base. */
export const reorderLanguages = async (api: APIRequestContext, projectId: string, tags: string[]) => {
	const languages = await listLanguages(api, projectId)
	const languageIds = tags.map((tag) => languages.find((language) => language.tag === tag)!.id)
	const response = await api.put(`${projectLanguagesApi(projectId)}/order`, { data: { languageIds }, headers: MUTATION_HEADERS })
	expect(response.status(), `PUT ${projectLanguagesApi(projectId)}/order`).toBe(200)
}
