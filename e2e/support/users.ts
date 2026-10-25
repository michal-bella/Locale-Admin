import { randomBytes } from 'node:crypto'

import { type APIRequest, type APIRequestContext, expect, type Page } from '@playwright/test'

import { type AdminUser, MUTATION_HEADERS, type ProjectRole, type Role } from './api'
import { type Credentials, STORAGE_STATE } from './auth'
import { createProject, projectMembersApi } from './projects'

/** Every user the suite creates (members and admins) uses this prefix, so the teardown can delete them. */
export const TEST_USER_EMAIL_PREFIX = 'e2e-editor-'

export const newTestUserCredentials = (): Credentials => ({
	email: `${TEST_USER_EMAIL_PREFIX}${Date.now()}-${randomBytes(3).toString('hex')}@example.com`,
	password: randomBytes(18).toString('base64url'),
})

export type TestUser = Credentials & { id: string; createdAt: string }

export type TestEditor = TestUser & { projectId: string; projectSlug: string }

const withAdminApi = async <T>(request: APIRequest, baseURL: string | undefined, fn: (api: Awaited<ReturnType<APIRequest['newContext']>>) => Promise<T>) => {
	const api = await request.newContext({ baseURL, storageState: STORAGE_STATE.ADMIN })
	try {
		return await fn(api)
	} finally {
		await api.dispose()
	}
}

const postUser = async (api: Awaited<ReturnType<APIRequest['newContext']>>, role: Role): Promise<TestUser> => {
	const credentials = newTestUserCredentials()
	const response = await api.post('/api/admin/users', { data: { ...credentials, role }, headers: MUTATION_HEADERS })
	expect(response.status(), 'POST /api/admin/users').toBe(201)
	const { id, createdAt } = (await response.json()) as AdminUser
	return { ...credentials, id, createdAt }
}

/** Adds an existing user to a project as the ADMIN (`POST /api/projects/:id/members`) with the role in the project (`EDITOR` by default). */
export const addMember = async (api: APIRequestContext, projectId: string, userId: string, role: ProjectRole = 'EDITOR') => {
	const response = await api.post(projectMembersApi(projectId), { data: { userId, role }, headers: MUTATION_HEADERS })
	expect(response.status(), `POST ${projectMembersApi(projectId)}`).toBe(201)
}

/** Creates a project as the ADMIN (only an ADMIN creates projects, without becoming a member) with the user as its only member. */
export const createProjectOf = async (api: APIRequestContext, label: string, userId: string) => {
	const project = await createProject(api, label)
	await addMember(api, project.id, userId)
	return { ...project, isMember: false, memberCount: 1 }
}

/** Creates a USER with no project through `POST /api/admin/users` as the ADMIN. Needs the ADMIN storage state from the setup project. */
export const createMember = (request: APIRequest, baseURL: string | undefined): Promise<TestUser> =>
	withAdminApi(request, baseURL, (api) => postUser(api, 'USER'))

/** Creates a USER who is an EDITOR of a new test project. */
export const createEditor = (request: APIRequest, baseURL: string | undefined): Promise<TestEditor> =>
	withAdminApi(request, baseURL, async (api) => {
		const project = await createProject(api, 'editor')
		const user = await postUser(api, 'USER')
		await addMember(api, project.id, user.id)
		return { ...user, projectId: project.id, projectSlug: project.slug }
	})

/** Creates a USER who is a VISITOR of a new test project (sk base, en, no keys), as `createEditor`. */
export const createVisitor = (request: APIRequest, baseURL: string | undefined): Promise<TestEditor> =>
	withAdminApi(request, baseURL, async (api) => {
		const project = await createProject(api, 'visitor')
		const user = await postUser(api, 'USER')
		await addMember(api, project.id, user.id, 'VISITOR')
		return { ...user, projectId: project.id, projectSlug: project.slug }
	})

/** Creates an ADMIN through `POST /api/admin/users` as the ADMIN. */
export const createAdmin = (request: APIRequest, baseURL: string | undefined): Promise<TestUser> =>
	withAdminApi(request, baseURL, (api) => postUser(api, 'ADMIN'))

/** Signs the page in through `POST /api/auth/login` on `page.request`, which shares the cookies of the page. Use with `test.use({ storageState: ANONYMOUS })`. */
export const loginViaApi = async (page: Page, { email, password }: Credentials) => {
	const response = await page.request.post('/api/auth/login', { data: { email, password }, headers: MUTATION_HEADERS })
	expect(response.status(), 'POST /api/auth/login').toBe(200)
}

/**
 * Creates an ADMIN and signs the page in as them through `POST /api/auth/login` on `page.request`, which shares the cookies of the page.
 * For tests that change per-user state (the translations view preference): the shared ADMIN storage state is used by every parallel test.
 * Use with `test.use({ storageState: ANONYMOUS })`.
 */
export const loginAsFreshAdmin = async (page: Page, request: APIRequest, baseURL: string | undefined) => {
	const admin = await createAdmin(request, baseURL)
	await loginViaApi(page, admin)
	return admin
}
