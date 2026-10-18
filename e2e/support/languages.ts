import { type APIRequest, type APIRequestContext, expect } from '@playwright/test'

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
