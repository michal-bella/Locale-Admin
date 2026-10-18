import { type APIRequestContext, expect, test } from '@playwright/test'

import { type AdminUser, MUTATION_HEADERS, readApiError } from '../support/api'
import { ANONYMOUS, STORAGE_STATE } from '../support/auth'
import { type Language, listLanguages, projectLanguagesApi } from '../support/languages'
import {
	createProject,
	listProjects,
	projectMembersApi,
	projectMembershipApi,
	PROJECTS_API,
	projectSettingsApi,
	TEST_PROJECT_SLUG_PREFIX,
} from '../support/projects'
import { createEditor, newTestUserCredentials } from '../support/users'

const CREDENTIALS = { email: 'csrf-check@example.com', password: 'irrelevant' }

const listUserEmails = async (api: APIRequestContext) => {
	const response = await api.get('/api/admin/users')
	expect(response.status()).toBe(200)
	return ((await response.json()) as { users: AdminUser[] }).users.map(({ email }) => email)
}

test.describe('anonymous', () => {
	test.use({ storageState: ANONYMOUS })

	test('GET /api/health returns 200', async ({ request }) => {
		const response = await request.get('/api/health')
		expect(response.status()).toBe(200)
		expect(await response.json()).toMatchObject({ status: 'ok', db: { status: 'ok' } })
	})

	test('POST without X-Requested-With is rejected with CSRF_REJECTED', async ({ request }) => {
		const response = await request.post('/api/auth/login', { data: CREDENTIALS })
		expect(response.status()).toBe(403)
		expect((await readApiError(response)).code).toBe('CSRF_REJECTED')
	})

	test('POST with application/x-www-form-urlencoded is rejected with CSRF_REJECTED', async ({ request }) => {
		const response = await request.post('/api/auth/login', { form: CREDENTIALS, headers: { 'X-Requested-With': 'XMLHttpRequest' } })
		expect(response.status()).toBe(403)
		expect((await readApiError(response)).code).toBe('CSRF_REJECTED')
	})

	test('GET and POST /api/admin/users return 401 AUTH_UNAUTHENTICATED', async ({ request }) => {
		const list = await request.get('/api/admin/users')
		expect(list.status()).toBe(401)
		expect((await readApiError(list)).code).toBe('AUTH_UNAUTHENTICATED')

		const create = await request.post('/api/admin/users', { data: newTestUserCredentials(), headers: MUTATION_HEADERS })
		expect(create.status()).toBe(401)
		expect((await readApiError(create)).code).toBe('AUTH_UNAUTHENTICATED')
	})
})

test.describe('ADMIN /api/admin/users', () => {
	test.use({ storageState: STORAGE_STATE.ADMIN })

	test('POST creates an ADMIN with a normalized email even when the body asks for EDITOR', async ({ request }) => {
		const credentials = newTestUserCredentials()
		const response = await request.post('/api/admin/users', {
			data: { ...credentials, email: `  ${credentials.email.toUpperCase()} `, role: 'EDITOR' },
			headers: MUTATION_HEADERS,
		})
		expect(response.status()).toBe(201)
		const body = (await response.json()) as Record<string, unknown>
		expect(body).toEqual({ id: expect.any(String), email: credentials.email, role: 'ADMIN', createdAt: expect.any(String) })
		expect(new Date(body.createdAt as string).toISOString()).toBe(body.createdAt)

		const users = ((await (await request.get('/api/admin/users')).json()) as { users: AdminUser[] }).users
		expect(users.find(({ id }) => id === body.id)).toEqual(body)
		const createdAts = users.map(({ createdAt }) => createdAt)
		expect(createdAts).toEqual([...createdAts].sort().reverse())
		expect(users.every(({ role }) => role === 'ADMIN')).toBe(true)
	})

	test('POST with an invalid body returns 400 with details per field', async ({ request }) => {
		const invalid = await request.post('/api/admin/users', { data: { email: 'not-an-email', password: 'short' }, headers: MUTATION_HEADERS })
		expect(invalid.status()).toBe(400)
		const invalidError = await readApiError(invalid)
		expect(invalidError.code).toBe('VALIDATION_ERROR')
		expect(invalidError.details).toEqual(
			expect.arrayContaining([
				{ path: 'email', code: 'INVALID_EMAIL' },
				{ path: 'password', code: 'TOO_SHORT', params: { min: 8 } },
			]),
		)

		const empty = await request.post('/api/admin/users', { data: {}, headers: MUTATION_HEADERS })
		expect(empty.status()).toBe(400)
		const emptyError = await readApiError(empty)
		expect(emptyError.code).toBe('VALIDATION_ERROR')
		expect(emptyError.details).toEqual(
			expect.arrayContaining([
				{ path: 'email', code: 'REQUIRED' },
				{ path: 'password', code: 'REQUIRED' },
			]),
		)
	})

	test('POST with an existing email in a different letter case returns 409 EMAIL_TAKEN', async ({ request, playwright, baseURL }) => {
		const existing = await createEditor(playwright.request, baseURL)
		const response = await request.post('/api/admin/users', {
			data: { email: existing.email.toUpperCase(), password: newTestUserCredentials().password },
			headers: MUTATION_HEADERS,
		})
		expect(response.status()).toBe(409)
		expect((await readApiError(response)).code).toBe('EMAIL_TAKEN')
	})

	test('POST without X-Requested-With returns 403 CSRF_REJECTED and creates nothing', async ({ request }) => {
		const credentials = newTestUserCredentials()
		const response = await request.post('/api/admin/users', { data: credentials })
		expect(response.status()).toBe(403)
		expect((await readApiError(response)).code).toBe('CSRF_REJECTED')
		expect(await listUserEmails(request)).not.toContain(credentials.email)
	})
})

test.describe('EDITOR /api/admin/users', () => {
	test.use({ storageState: STORAGE_STATE.EDITOR })

	test('GET and POST return 403 FORBIDDEN', async ({ request, playwright, baseURL }) => {
		const list = await request.get('/api/admin/users')
		expect(list.status()).toBe(403)
		expect((await readApiError(list)).code).toBe('FORBIDDEN')

		const credentials = newTestUserCredentials()
		const create = await request.post('/api/admin/users', { data: credentials, headers: MUTATION_HEADERS })
		expect(create.status()).toBe(403)
		expect((await readApiError(create)).code).toBe('FORBIDDEN')

		const admin = await playwright.request.newContext({ baseURL, storageState: STORAGE_STATE.ADMIN })
		expect(await listUserEmails(admin)).not.toContain(credentials.email)
		await admin.dispose()
	})
})

test.describe('/api/profile', () => {
	test.use({ storageState: ANONYMOUS })

	test('PATCH saves trimmed names and ignores email and role in the body', async ({ request, playwright, baseURL }) => {
		const editor = await createEditor(playwright.request, baseURL)
		const login = await request.post('/api/auth/login', { data: { email: editor.email, password: editor.password }, headers: MUTATION_HEADERS })
		expect(login.status()).toBe(200)

		const update = await request.patch('/api/profile', {
			data: { firstName: '  Jana ', lastName: 'Kováčová', email: 'changed@example.com', role: 'ADMIN' },
			headers: MUTATION_HEADERS,
		})
		expect(update.status()).toBe(200)
		const expected = { id: editor.id, email: editor.email, role: 'EDITOR', firstName: 'Jana', lastName: 'Kováčová', passwordChangedAt: expect.any(String) }
		expect(await update.json()).toEqual(expected)
		expect(await (await request.get('/api/profile')).json()).toEqual(expected)

		const invalid = await request.patch('/api/profile', { data: { firstName: ' ', lastName: 'a'.repeat(101) }, headers: MUTATION_HEADERS })
		expect(invalid.status()).toBe(400)
		const error = await readApiError(invalid)
		expect(error.code).toBe('VALIDATION_ERROR')
		expect(error.details).toEqual(
			expect.arrayContaining([
				{ path: 'firstName', code: 'REQUIRED' },
				{ path: 'lastName', code: 'TOO_LONG', params: { max: 100 } },
			]),
		)

		const withoutCsrfHeader = await request.patch('/api/profile', { data: { firstName: 'X', lastName: 'Y' } })
		expect(withoutCsrfHeader.status()).toBe(403)
		expect((await readApiError(withoutCsrfHeader)).code).toBe('CSRF_REJECTED')
		expect(await (await request.get('/api/profile')).json()).toEqual(expected)
	})
})

test.describe('/api/projects/:projectId/languages', () => {
	test.use({ storageState: STORAGE_STATE.ADMIN })

	test('lists, adds and removes languages of a project with the error contract; the global endpoints are gone', async ({ request, playwright, baseURL }) => {
		const project = await createProject(request, 'smoke-languages', ['sk', 'en'])
		const url = projectLanguagesApi(project.id)

		const languages = await listLanguages(request, project.id)
		expect(languages.map(({ tag, isBase }) => ({ tag, isBase }))).toEqual([
			{ tag: 'sk', isBase: true },
			{ tag: 'en', isBase: false },
		])

		const created = await request.post(url, { data: { tag: 'ro', englishName: 'Ignored', isBase: true }, headers: MUTATION_HEADERS })
		expect(created.status()).toBe(201)
		const romanian = (await created.json()) as Language
		expect(romanian).toEqual({
			id: expect.any(String),
			tag: 'ro',
			englishName: 'Romanian',
			nativeName: 'română',
			flagCode: 'ro',
			isBase: false,
			createdAt: expect.any(String),
		})

		const duplicate = await request.post(url, { data: { tag: 'ro' }, headers: MUTATION_HEADERS })
		expect(duplicate.status()).toBe(409)
		expect((await readApiError(duplicate)).code).toBe('LANGUAGE_TAKEN')
		const invalid = await request.post(url, { data: { tag: 'xx' }, headers: MUTATION_HEADERS })
		expect(invalid.status()).toBe(400)
		expect((await readApiError(invalid)).details).toEqual([{ path: 'tag', code: 'INVALID' }])
		const withoutCsrfHeader = await request.post(url, { data: { tag: 'hu' } })
		expect(withoutCsrfHeader.status()).toBe(403)
		expect((await readApiError(withoutCsrfHeader)).code).toBe('CSRF_REJECTED')

		const base = languages.find(({ isBase }) => isBase)!
		const deleteBase = await request.delete(`${url}/${base.id}`, { data: {}, headers: MUTATION_HEADERS })
		expect(deleteBase.status()).toBe(409)
		expect((await readApiError(deleteBase)).code).toBe('LANGUAGE_IS_BASE')
		const deleted = await request.delete(`${url}/${romanian.id}`, { data: {}, headers: MUTATION_HEADERS })
		expect(deleted.status()).toBe(204)
		for (const missing of [`${url}/${romanian.id}`, `${url}/not-a-uuid`]) {
			const notFound = await request.delete(missing, { data: {}, headers: MUTATION_HEADERS })
			expect(notFound.status()).toBe(404)
			expect((await readApiError(notFound)).code).toBe('NOT_FOUND')
		}

		for (const gone of ['/api/languages', '/api/admin/languages']) {
			expect((await request.get(gone)).status()).toBe(404)
		}

		const anonymous = await playwright.request.newContext({ baseURL, storageState: ANONYMOUS })
		const unauthenticated = await anonymous.get(url)
		expect(unauthenticated.status()).toBe(401)
		expect((await readApiError(unauthenticated)).code).toBe('AUTH_UNAUTHENTICATED')
		await anonymous.dispose()
	})
})

test.describe('anonymous /api/projects', () => {
	test.use({ storageState: ANONYMOUS })

	test('GET and POST return 401 AUTH_UNAUTHENTICATED', async ({ request }) => {
		const list = await request.get(PROJECTS_API)
		expect(list.status()).toBe(401)
		expect((await readApiError(list)).code).toBe('AUTH_UNAUTHENTICATED')

		const create = await request.post(PROJECTS_API, { data: { name: 'X', slug: `${TEST_PROJECT_SLUG_PREFIX}anon` }, headers: MUTATION_HEADERS })
		expect(create.status()).toBe(401)
		expect((await readApiError(create)).code).toBe('AUTH_UNAUTHENTICATED')
	})
})

test.describe('/api/projects as a member', () => {
	test.use({ storageState: ANONYMOUS })

	test('a member sees only own projects, creates one, adds a member, leaves and cannot open a foreign project', async ({ request, playwright, baseURL }) => {
		const editor = await createEditor(playwright.request, baseURL)
		const login = await request.post('/api/auth/login', { data: { email: editor.email, password: editor.password }, headers: MUTATION_HEADERS })
		expect(login.status()).toBe(200)
		expect((await listProjects(request)).map(({ id }) => id)).toEqual([editor.projectId])

		const created = await createProject(request, 'smoke')
		expect(created).toMatchObject({ isMember: true, primaryColor: '#E83E8C' })
		const duplicate = await request.post(PROJECTS_API, { data: { name: 'Duplicate', slug: created.slug, languageTags: ['sk'] }, headers: MUTATION_HEADERS })
		expect(duplicate.status()).toBe(409)
		expect((await readApiError(duplicate)).code).toBe('SLUG_TAKEN')

		const lastMember = await request.delete(projectMembershipApi(created.id), { data: {}, headers: MUTATION_HEADERS })
		expect(lastMember.status()).toBe(409)
		expect((await readApiError(lastMember)).code).toBe('LAST_MEMBER')

		const member = newTestUserCredentials()
		const added = await request.post(projectMembersApi(created.id), { data: member, headers: MUTATION_HEADERS })
		expect(added.status()).toBe(201)
		expect(await added.json()).toEqual({ id: expect.any(String), email: member.email, firstName: null, lastName: null, createdAt: expect.any(String) })
		const members = (await (await request.get(projectMembersApi(created.id))).json()) as { members: { email: string }[] }
		expect(members.members.map(({ email }) => email)).toEqual([editor.email, member.email])

		const left = await request.delete(projectMembershipApi(created.id), { data: {}, headers: MUTATION_HEADERS })
		expect(left.status()).toBe(204)
		const afterLeave = await request.get(projectSettingsApi(created.id))
		expect(afterLeave.status()).toBe(404)
		expect((await readApiError(afterLeave)).code).toBe('NOT_FOUND')
		expect((await listProjects(request)).map(({ id }) => id)).toEqual([editor.projectId])
	})
})

test.describe('ADMIN /api/projects', () => {
	test.use({ storageState: STORAGE_STATE.ADMIN })

	test('GET also lists a project the admin is not a member of, with isMember false', async ({ request, playwright, baseURL }) => {
		const editor = await createEditor(playwright.request, baseURL)
		const editorApi = await playwright.request.newContext({ baseURL, storageState: ANONYMOUS })
		const login = await editorApi.post('/api/auth/login', { data: { email: editor.email, password: editor.password }, headers: MUTATION_HEADERS })
		expect(login.status()).toBe(200)
		const ownedByMember = await createProject(editorApi, 'member-owned')
		await editorApi.dispose()

		const project = (await listProjects(request)).find(({ id }) => id === ownedByMember.id)
		expect(project).toEqual({ ...ownedByMember, isMember: false })
		expect((await request.get(projectSettingsApi(ownedByMember.id))).status()).toBe(200)
	})
})
