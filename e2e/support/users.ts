import { randomBytes } from 'node:crypto'

import { type APIRequest, expect } from '@playwright/test'

import { type AdminUser, MUTATION_HEADERS } from './api'
import { type Credentials, STORAGE_STATE } from './auth'
import { createProject, projectMembersApi } from './projects'

/** Every user the suite creates (members and admins) uses this prefix, so the teardown can delete them. */
export const TEST_USER_EMAIL_PREFIX = 'e2e-editor-'

export const newTestUserCredentials = (): Credentials => ({
	email: `${TEST_USER_EMAIL_PREFIX}${Date.now()}-${randomBytes(3).toString('hex')}@example.com`,
	password: randomBytes(18).toString('base64url'),
})

export type TestUser = Credentials & { id: string; createdAt: string }

export type TestEditor = TestUser & { projectId: string }

const withAdminApi = async <T>(request: APIRequest, baseURL: string | undefined, fn: (api: Awaited<ReturnType<APIRequest['newContext']>>) => Promise<T>) => {
	const api = await request.newContext({ baseURL, storageState: STORAGE_STATE.ADMIN })
	try {
		return await fn(api)
	} finally {
		await api.dispose()
	}
}

/**
 * Creates an EDITOR (a project member) as the ADMIN: a new test project, then `POST /api/projects/:id/members`.
 * Needs the ADMIN storage state from the setup project.
 */
export const createEditor = (request: APIRequest, baseURL: string | undefined): Promise<TestEditor> =>
	withAdminApi(request, baseURL, async (api) => {
		const project = await createProject(api, 'editor')
		const credentials = newTestUserCredentials()
		const response = await api.post(projectMembersApi(project.id), { data: credentials, headers: MUTATION_HEADERS })
		expect(response.status(), `POST ${projectMembersApi(project.id)}`).toBe(201)
		const { id, createdAt } = (await response.json()) as { id: string; createdAt: string }
		return { ...credentials, id, createdAt, projectId: project.id }
	})

/** Creates an ADMIN through `POST /api/admin/users` as the ADMIN. */
export const createAdmin = (request: APIRequest, baseURL: string | undefined): Promise<TestUser> =>
	withAdminApi(request, baseURL, async (api) => {
		const credentials = newTestUserCredentials()
		const response = await api.post('/api/admin/users', { data: credentials, headers: MUTATION_HEADERS })
		expect(response.status(), 'POST /api/admin/users').toBe(201)
		const { id, createdAt } = (await response.json()) as AdminUser
		return { ...credentials, id, createdAt }
	})
