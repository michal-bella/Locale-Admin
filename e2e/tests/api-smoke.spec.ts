import { randomUUID } from 'node:crypto'

import { type APIRequestContext, expect, test } from '@playwright/test'

import { type AdminUser, MUTATION_HEADERS, readApiError } from '../support/api'
import { ANONYMOUS, STORAGE_STATE } from '../support/auth'
import { BROKEN_CSV, importApi, importFile, importPreviewApi, readFixture, SAMPLE_CSV } from '../support/imports'
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
import { insertTranslationKeys, listTranslations, PREFERENCES_API, projectTranslationsApi, translationApi, translationKeyApi } from '../support/translations'
import { addMember, createEditor, createMember, newTestUserCredentials } from '../support/users'

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

		const create = await request.post('/api/admin/users', { data: { ...newTestUserCredentials(), role: 'EDITOR' }, headers: MUTATION_HEADERS })
		expect(create.status()).toBe(401)
		expect((await readApiError(create)).code).toBe('AUTH_UNAUTHENTICATED')
	})
})

test.describe('ADMIN /api/admin/users', () => {
	test.use({ storageState: STORAGE_STATE.ADMIN })

	test('POST creates a user with the given role and a normalized email, GET lists everyone newest first', async ({ request }) => {
		const credentials = newTestUserCredentials()
		const response = await request.post('/api/admin/users', {
			data: { ...credentials, email: `  ${credentials.email.toUpperCase()} `, role: 'EDITOR' },
			headers: MUTATION_HEADERS,
		})
		expect(response.status()).toBe(201)
		const body = (await response.json()) as Record<string, unknown>
		expect(body).toEqual({ id: expect.any(String), email: credentials.email, role: 'EDITOR', projectCount: 0, createdAt: expect.any(String) })
		expect(new Date(body.createdAt as string).toISOString()).toBe(body.createdAt)

		const users = ((await (await request.get('/api/admin/users')).json()) as { users: AdminUser[] }).users
		expect(users.find(({ id }) => id === body.id)).toEqual(body)
		const createdAts = users.map(({ createdAt }) => createdAt)
		expect(createdAts).toEqual([...createdAts].sort().reverse())
		expect(users.some(({ role }) => role === 'ADMIN')).toBe(true)
	})

	test('POST with an invalid body returns 400 with details per field', async ({ request }) => {
		const invalid = await request.post('/api/admin/users', { data: { email: 'not-an-email', password: 'short', role: 'OWNER' }, headers: MUTATION_HEADERS })
		expect(invalid.status()).toBe(400)
		const invalidError = await readApiError(invalid)
		expect(invalidError.code).toBe('VALIDATION_ERROR')
		expect(invalidError.details).toEqual(
			expect.arrayContaining([
				{ path: 'email', code: 'INVALID_EMAIL' },
				{ path: 'password', code: 'TOO_SHORT', params: { min: 8 } },
				{ path: 'role', code: 'INVALID' },
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
				{ path: 'role', code: 'INVALID' },
			]),
		)
	})

	test('POST with an existing email in a different letter case returns 409 EMAIL_TAKEN', async ({ request, playwright, baseURL }) => {
		const existing = await createEditor(playwright.request, baseURL)
		const response = await request.post('/api/admin/users', {
			data: { email: existing.email.toUpperCase(), password: newTestUserCredentials().password, role: 'EDITOR' },
			headers: MUTATION_HEADERS,
		})
		expect(response.status()).toBe(409)
		expect((await readApiError(response)).code).toBe('EMAIL_TAKEN')
	})

	test('POST without X-Requested-With returns 403 CSRF_REJECTED and creates nothing', async ({ request }) => {
		const credentials = newTestUserCredentials()
		const response = await request.post('/api/admin/users', { data: { ...credentials, role: 'EDITOR' } })
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
		const create = await request.post('/api/admin/users', { data: { ...credentials, role: 'EDITOR' }, headers: MUTATION_HEADERS })
		expect(create.status()).toBe(403)
		expect((await readApiError(create)).code).toBe('FORBIDDEN')

		const admin = await playwright.request.newContext({ baseURL, storageState: STORAGE_STATE.ADMIN })
		expect(await listUserEmails(admin)).not.toContain(credentials.email)
		await admin.dispose()
	})
})

test.describe('/api/profile', () => {
	test.use({ storageState: ANONYMOUS })

	test('PATCH saves trimmed names, ignores email and the own role, and rejects another role of an EDITOR', async ({ request, playwright, baseURL }) => {
		const editor = await createEditor(playwright.request, baseURL)
		const login = await request.post('/api/auth/login', { data: { email: editor.email, password: editor.password }, headers: MUTATION_HEADERS })
		expect(login.status()).toBe(200)

		const promote = await request.patch('/api/profile', { data: { firstName: 'Jana', lastName: 'Kováčová', role: 'ADMIN' }, headers: MUTATION_HEADERS })
		expect(promote.status()).toBe(403)
		expect((await readApiError(promote)).code).toBe('FORBIDDEN')

		const update = await request.patch('/api/profile', {
			data: { firstName: '  Jana ', lastName: 'Kováčová', email: 'changed@example.com', role: 'EDITOR' },
			headers: MUTATION_HEADERS,
		})
		expect(update.status()).toBe(200)
		const expected = {
			id: editor.id,
			email: editor.email,
			role: 'EDITOR',
			firstName: 'Jana',
			lastName: 'Kováčová',
			preferences: { translationsView: 'EXTENDED', translationsLayout: 'COLUMNS' },
			passwordChangedAt: expect.any(String),
		}
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

	test('PATCH /api/profile/preferences saves the translations view, /api/auth/me reflects it and an unknown value is rejected', async ({
		request,
		playwright,
		baseURL,
	}) => {
		const editor = await createEditor(playwright.request, baseURL)
		const login = await request.post('/api/auth/login', { data: { email: editor.email, password: editor.password }, headers: MUTATION_HEADERS })
		expect(login.status()).toBe(200)
		const me = async () => (await request.get('/api/auth/me')).json() as Promise<{ preferences: { translationsView: string } }>
		expect(await me()).toMatchObject({ id: editor.id, preferences: { translationsView: 'EXTENDED' } })

		const compact = await request.patch(PREFERENCES_API, { data: { translationsView: 'COMPACT' }, headers: MUTATION_HEADERS })
		expect(compact.status()).toBe(200)
		const expected = {
			id: editor.id,
			email: editor.email,
			role: 'EDITOR',
			firstName: null,
			lastName: null,
			preferences: { translationsView: 'COMPACT', translationsLayout: 'COLUMNS' },
			passwordChangedAt: expect.any(String),
		}
		expect(await compact.json()).toEqual(expected)
		expect(await (await request.get('/api/profile')).json()).toEqual(expected)
		expect((await me()).preferences).toEqual({ translationsView: 'COMPACT', translationsLayout: 'COLUMNS' })

		for (const [data, path] of [
			[{ translationsView: 'WIDE' }, 'translationsView'],
			[{ translationsView: 'compact' }, 'translationsView'],
			[{}, ''],
		] as const) {
			const invalid = await request.patch(PREFERENCES_API, { data, headers: MUTATION_HEADERS })
			expect(invalid.status(), JSON.stringify(data)).toBe(400)
			const error = await readApiError(invalid)
			expect(error.code).toBe('VALIDATION_ERROR')
			expect(error.details).toEqual([expect.objectContaining({ path, code: expect.any(String) })])
		}
		const withoutCsrfHeader = await request.patch(PREFERENCES_API, { data: { translationsView: 'EXTENDED' } })
		expect(withoutCsrfHeader.status()).toBe(403)
		expect((await readApiError(withoutCsrfHeader)).code).toBe('CSRF_REJECTED')
		expect((await me()).preferences).toEqual({ translationsView: 'COMPACT', translationsLayout: 'COLUMNS' })

		const anonymous = await playwright.request.newContext({ baseURL, storageState: ANONYMOUS })
		const unauthenticated = await anonymous.patch(PREFERENCES_API, { data: { translationsView: 'EXTENDED' }, headers: MUTATION_HEADERS })
		expect(unauthenticated.status()).toBe(401)
		expect((await readApiError(unauthenticated)).code).toBe('AUTH_UNAUTHENTICATED')
		await anonymous.dispose()

		const restored = await request.patch(PREFERENCES_API, { data: { translationsView: 'EXTENDED' }, headers: MUTATION_HEADERS })
		expect(restored.status()).toBe(200)
		expect(await restored.json()).toMatchObject({ preferences: { translationsView: 'EXTENDED' } })
		expect((await me()).preferences).toEqual({ translationsView: 'EXTENDED', translationsLayout: 'COLUMNS' })
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

	test('a member sees only own projects, creates one, lists members but cannot add or remove them, leaves and cannot open a foreign project', async ({
		request,
		playwright,
		baseURL,
	}) => {
		const editor = await createEditor(playwright.request, baseURL)
		const member = await createMember(playwright.request, baseURL)
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

		const forbiddenAdd = await request.post(projectMembersApi(created.id), { data: { userId: member.id }, headers: MUTATION_HEADERS })
		expect(forbiddenAdd.status()).toBe(403)
		expect((await readApiError(forbiddenAdd)).code).toBe('FORBIDDEN')
		const admin = await playwright.request.newContext({ baseURL, storageState: STORAGE_STATE.ADMIN })
		await addMember(admin, created.id, member.id)
		const alreadyMember = await admin.post(projectMembersApi(created.id), { data: { userId: member.id }, headers: MUTATION_HEADERS })
		expect(alreadyMember.status()).toBe(409)
		expect((await readApiError(alreadyMember)).code).toBe('ALREADY_MEMBER')
		await admin.dispose()
		const members = (await (await request.get(projectMembersApi(created.id))).json()) as { members: { email: string }[] }
		expect(members.members.map(({ email }) => email)).toEqual([editor.email, member.email])
		const forbiddenRemove = await request.delete(`${projectMembersApi(created.id)}/${member.id}`, { data: {}, headers: MUTATION_HEADERS })
		expect(forbiddenRemove.status()).toBe(403)
		expect((await readApiError(forbiddenRemove)).code).toBe('FORBIDDEN')

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

test.describe('/api/projects/:projectId/translations', () => {
	test.use({ storageState: STORAGE_STATE.ADMIN })

	test('lists keys with a cell per language, the row status by the target or by every language, validates the query and hides foreign projects and languages', async ({
		request,
		playwright,
		baseURL,
	}) => {
		const project = await createProject(request, 'smoke-tr', ['sk', 'en'])
		const languages = await listLanguages(request, project.id)
		const [sk, en] = languages
		await insertTranslationKeys(project.id, languages, [
			{ namespace: 'loc', name: 'orders.empty.title', values: { sk: 'Zatiaľ nemáte žiadne objednávky', en: null } },
			{ namespace: 'loc', name: 'dashboard.welcome', values: { sk: 'Vitajte, {{name}}', en: 'Welcome, {{name}}' } },
			{ namespace: 'loc', name: 'legal.terms', values: { sk: null, en: 'Terms' } },
			{ namespace: 'paths', name: 'Adresa nie je kompletná. Uistite sa', values: { sk: 'Adresa' } },
		])
		const url = projectTranslationsApi(project.id)
		const languageParams = { sourceLanguageId: sk!.id, targetLanguageId: en!.id }
		const key = (name: string, group: string) => ({
			keyId: expect.any(String),
			namespace: group.split(':')[0],
			name,
			group,
			description: null,
			plural: null,
		})
		// Rows seeded with SQL have no editor.
		const cell = (value: string | null, updatedAt: unknown = expect.any(String)) => ({
			value,
			status: value === null ? 'UNTRANSLATED' : 'TRANSLATED',
			updatedAt,
			updatedBy: null,
		})
		const EMPTY_CELL = cell(null, null)

		// Compact semantics: the target language decides the row status, the stats and the order.
		const list = await request.get(url, { params: languageParams })
		expect(list.status()).toBe(200)
		const body = (await list.json()) as { items: { translations: Record<string, { updatedAt: string | null }> }[] }
		expect(body).toEqual({
			items: [
				{
					...key('orders.empty.title', 'loc:orders.empty'),
					status: 'UNTRANSLATED',
					translations: { [sk!.id]: cell('Zatiaľ nemáte žiadne objednávky'), [en!.id]: cell(null) },
				},
				{
					...key('Adresa nie je kompletná. Uistite sa', 'paths'),
					status: 'UNTRANSLATED',
					translations: { [sk!.id]: cell('Adresa'), [en!.id]: EMPTY_CELL },
				},
				{
					...key('dashboard.welcome', 'loc:dashboard'),
					status: 'TRANSLATED',
					translations: { [sk!.id]: cell('Vitajte, {{name}}'), [en!.id]: cell('Welcome, {{name}}') },
				},
				{ ...key('legal.terms', 'loc:legal'), status: 'TRANSLATED', translations: { [sk!.id]: cell(null), [en!.id]: cell('Terms') } },
			],
			total: 4,
			page: 1,
			pageSize: 20,
			stats: { totalKeys: 4, translated: 2, untranslated: 2 },
			namespaces: ['loc', 'paths'],
			editors: [],
		})
		const updatedAt = body.items[0]!.translations[en!.id]!.updatedAt!
		expect(new Date(updatedAt).toISOString()).toBe(updatedAt)

		// Extended semantics (no language pair): a row is translated only with a value in every language; the search covers every language.
		const extended = await request.get(url)
		expect(extended.status()).toBe(200)
		expect(await extended.json()).toMatchObject({
			items: [
				{ name: 'legal.terms', status: 'UNTRANSLATED' },
				{ name: 'orders.empty.title', status: 'UNTRANSLATED' },
				{ name: 'Adresa nie je kompletná. Uistite sa', status: 'UNTRANSLATED' },
				{ name: 'dashboard.welcome', status: 'TRANSLATED', translations: { [sk!.id]: cell('Vitajte, {{name}}'), [en!.id]: cell('Welcome, {{name}}') } },
			],
			total: 4,
			stats: { totalKeys: 4, translated: 1, untranslated: 3 },
			namespaces: ['loc', 'paths'],
		})
		const extendedFiltered = await request.get(url, { params: { status: 'TRANSLATED' } })
		expect(await extendedFiltered.json()).toMatchObject({ items: [{ name: 'dashboard.welcome' }], total: 1 })
		const extendedSearch = await request.get(url, { params: { search: 'terms' } })
		expect(await extendedSearch.json()).toMatchObject({ items: [{ name: 'legal.terms' }], total: 1 })
		const compactSearch = await request.get(url, { params: { ...languageParams, search: 'terms' } })
		expect(await compactSearch.json()).toMatchObject({ items: [{ name: 'legal.terms' }], total: 1 })

		const filtered = await request.get(url, { params: { ...languageParams, search: 'WELCOME', status: 'TRANSLATED', namespace: 'loc', pageSize: 1 } })
		expect(filtered.status()).toBe(200)
		expect(await filtered.json()).toMatchObject({ items: [{ name: 'dashboard.welcome' }], total: 1, pageSize: 1, stats: { totalKeys: 4 } })
		const pastEnd = await request.get(url, { params: { ...languageParams, page: 5 } })
		expect(await pastEnd.json()).toMatchObject({ items: [], total: 4, page: 5 })

		for (const [params, path] of [
			[{ sourceLanguageId: sk!.id }, 'targetLanguageId'],
			[{ targetLanguageId: en!.id }, 'sourceLanguageId'],
			[{ ...languageParams, sourceLanguageId: 'not-a-uuid' }, 'sourceLanguageId'],
			[{ ...languageParams, status: 'REVIEW' }, 'status'],
			[{ ...languageParams, sort: 'RANDOM' }, 'sort'],
			[{ ...languageParams, pageSize: 101 }, 'pageSize'],
		] as const) {
			const invalid = await request.get(url, { params })
			expect(invalid.status(), JSON.stringify(params)).toBe(400)
			const error = await readApiError(invalid)
			expect(error.code).toBe('VALIDATION_ERROR')
			expect(error.details).toEqual([expect.objectContaining({ path, code: expect.any(String) })])
		}
		for (const [params, path] of [
			[{ sourceLanguageId: sk!.id }, 'targetLanguageId'],
			[{ targetLanguageId: en!.id }, 'sourceLanguageId'],
		] as const) {
			expect((await readApiError(await request.get(url, { params }))).details).toEqual([expect.objectContaining({ path, code: 'REQUIRED' })])
		}

		const other = await createProject(request, 'smoke-tr-other', ['sk'])
		const [otherSk] = await listLanguages(request, other.id)
		const foreignLanguage = await request.get(url, { params: { ...languageParams, targetLanguageId: otherSk!.id } })
		expect(foreignLanguage.status()).toBe(404)
		expect((await readApiError(foreignLanguage)).code).toBe('NOT_FOUND')

		const editor = await playwright.request.newContext({ baseURL, storageState: STORAGE_STATE.EDITOR })
		const foreignProject = await editor.get(url, { params: languageParams })
		expect(foreignProject.status()).toBe(404)
		expect((await readApiError(foreignProject)).code).toBe('NOT_FOUND')
		await editor.dispose()

		const anonymous = await playwright.request.newContext({ baseURL, storageState: ANONYMOUS })
		const unauthenticated = await anonymous.get(url, { params: languageParams })
		expect(unauthenticated.status()).toBe(401)
		expect((await readApiError(unauthenticated)).code).toBe('AUTH_UNAUTHENTICATED')
		await anonymous.dispose()
	})
})

test.describe('PUT /api/projects/:projectId/keys/:keyId/translations/:languageId', () => {
	test.use({ storageState: STORAGE_STATE.ADMIN })

	test('saves a translation, maps "" to null and returns the error contract for placeholders, unknown ids, length, CSRF and anonymous', async ({
		request,
		playwright,
		baseURL,
	}) => {
		const project = await createProject(request, 'smoke-tr-put', ['sk', 'en'])
		const languages = await listLanguages(request, project.id)
		const [sk, en] = languages
		await insertTranslationKeys(project.id, languages, [
			{ namespace: 'loc', name: 'dashboard.welcome', values: { sk: 'Vitajte späť, {{name}}', en: null } },
			{ namespace: 'loc', name: 'nav.home', values: { sk: 'Domov' } },
		])
		const list = () => listTranslations(request, project.id, { sourceLanguageId: sk!.id, targetLanguageId: en!.id })
		const items = (await list()).items
		const welcome = items.find(({ name }) => name === 'dashboard.welcome')!
		const home = items.find(({ name }) => name === 'nav.home')!
		const url = translationApi(project.id, welcome.keyId, en!.id)
		const targetOf = async (keyId: string) => (await list()).items.find((item) => item.keyId === keyId)!.translations[en!.id]

		const saved = await request.put(url, { data: { value: 'Welcome back, {{ name }}' }, headers: MUTATION_HEADERS })
		expect(saved.status()).toBe(200)
		const body = (await saved.json()) as { updatedAt: string }
		expect(body).toEqual({
			value: 'Welcome back, {{ name }}',
			status: 'TRANSLATED',
			updatedAt: expect.any(String),
			updatedBy: { id: expect.any(String), name: expect.any(String) },
		})
		expect(new Date(body.updatedAt).toISOString()).toBe(body.updatedAt)
		expect(await targetOf(welcome.keyId)).toEqual(body)
		expect(await list()).toMatchObject({ stats: { totalKeys: 2, translated: 1, untranslated: 1 } })

		const created = await request.put(translationApi(project.id, home.keyId, en!.id), { data: { value: 'Home' }, headers: MUTATION_HEADERS })
		expect(created.status()).toBe(200)
		expect(await created.json()).toMatchObject({ value: 'Home', status: 'TRANSLATED' })
		const emptied = await request.put(translationApi(project.id, home.keyId, en!.id), { data: { value: '' }, headers: MUTATION_HEADERS })
		expect(emptied.status()).toBe(200)
		expect(await emptied.json()).toEqual({
			value: null,
			status: 'UNTRANSLATED',
			updatedAt: expect.any(String),
			updatedBy: { id: expect.any(String), name: expect.any(String) },
		})
		expect(await list()).toMatchObject({ stats: { totalKeys: 2, translated: 1, untranslated: 1 } })

		const mismatch = await request.put(url, { data: { value: 'Welcome back, {{user}}' }, headers: MUTATION_HEADERS })
		expect(mismatch.status()).toBe(400)
		const mismatchError = await readApiError(mismatch)
		expect(mismatchError.code).toBe('PLACEHOLDER_MISMATCH')
		expect(mismatchError.details).toEqual({ missing: ['{{name}}'], extra: ['{{user}}'] })
		expect(await targetOf(welcome.keyId)).toEqual(body)

		const unknownKey = await request.put(translationApi(project.id, randomUUID(), en!.id), { data: { value: 'X' }, headers: MUTATION_HEADERS })
		expect(unknownKey.status()).toBe(404)
		expect((await readApiError(unknownKey)).code).toBe('TRANSLATION_KEY_NOT_FOUND')

		const other = await createProject(request, 'smoke-tr-put-other', ['sk'])
		const [otherSk] = await listLanguages(request, other.id)
		const foreignLanguage = await request.put(translationApi(project.id, welcome.keyId, otherSk!.id), { data: { value: 'X' }, headers: MUTATION_HEADERS })
		expect(foreignLanguage.status()).toBe(404)
		expect((await readApiError(foreignLanguage)).code).toBe('NOT_FOUND')

		for (const data of [{ value: 'x'.repeat(10_001) }, { value: 42 }, {}]) {
			const invalid = await request.put(url, { data, headers: MUTATION_HEADERS })
			expect(invalid.status(), JSON.stringify(data).slice(0, 30)).toBe(400)
			const error = await readApiError(invalid)
			expect(error.code).toBe('VALIDATION_ERROR')
			expect(error.details).toEqual([expect.objectContaining({ path: 'value' })])
		}
		expect(await targetOf(welcome.keyId)).toEqual(body)

		const withoutCsrfHeader = await request.put(url, { data: { value: 'X' } })
		expect(withoutCsrfHeader.status()).toBe(403)
		expect((await readApiError(withoutCsrfHeader)).code).toBe('CSRF_REJECTED')

		const anonymous = await playwright.request.newContext({ baseURL, storageState: ANONYMOUS })
		const unauthenticated = await anonymous.put(url, { data: { value: 'X' }, headers: MUTATION_HEADERS })
		expect(unauthenticated.status()).toBe(401)
		expect((await readApiError(unauthenticated)).code).toBe('AUTH_UNAUTHENTICATED')
		await anonymous.dispose()
		expect(await targetOf(welcome.keyId)).toEqual(body)
	})
})

test.describe('PATCH /api/projects/:projectId/keys/:keyId', () => {
	test.use({ storageState: STORAGE_STATE.ADMIN })

	test('renames, describes and makes a key plural with the error contract for taken names, validation, roles, unknown keys, CSRF and anonymous', async ({
		request,
		playwright,
		baseURL,
	}) => {
		const project = await createProject(request, 'smoke-key', ['sk', 'en'])
		const languages = await listLanguages(request, project.id)
		const [sk, en] = languages
		await insertTranslationKeys(project.id, languages, [
			{ namespace: 'loc', name: 'cart.items', values: { sk: 'Máte {{count}} položiek', en: 'You have {{count}} items' } },
			{ namespace: 'loc', name: 'orders.empty.title', values: { sk: 'Zatiaľ nemáte žiadne objednávky', en: null } },
		])
		const list = () => listTranslations(request, project.id)
		const itemOf = async (keyId: string) => (await list()).items.find((item) => item.keyId === keyId)!
		const cart = (await list()).items.find(({ name }) => name === 'cart.items')!
		const url = translationKeyApi(project.id, cart.keyId)
		const patch = (data: unknown) => request.patch(url, { data, headers: MUTATION_HEADERS })

		const renamed = await patch({ name: '  orders.items ' })
		expect(renamed.status()).toBe(200)
		expect(await renamed.json()).toEqual({
			keyId: cart.keyId,
			namespace: 'loc',
			name: 'orders.items',
			group: 'loc:orders',
			description: null,
			plural: null,
		})
		expect(await itemOf(cart.keyId)).toMatchObject({ name: 'orders.items', group: 'loc:orders', description: null, plural: null })

		const described = await patch({ description: ' Počet položiek v košíku ', plural: {} })
		expect(described.status()).toBe(200)
		expect(await described.json()).toMatchObject({ name: 'orders.items', description: 'Počet položiek v košíku', plural: { variable: 'count' } })
		expect(await itemOf(cart.keyId)).toMatchObject({
			description: 'Počet položiek v košíku',
			plural: { variable: 'count' },
			translations: {
				[sk!.id]: { value: '{count, plural, other {Máte {{count}} položiek}}' },
				[en!.id]: { value: '{count, plural, other {You have {{count}} items}}', status: 'TRANSLATED' },
			},
		})

		const renamedVariable = await patch({ plural: { variable: 'n' } })
		expect(renamedVariable.status()).toBe(200)
		expect(await itemOf(cart.keyId)).toMatchObject({
			plural: { variable: 'n' },
			translations: {
				[sk!.id]: { value: '{n, plural, other {Máte {{count}} položiek}}' },
				[en!.id]: { value: '{n, plural, other {You have {{count}} items}}' },
			},
		})

		const disabled = await patch({ plural: null, description: null })
		expect(disabled.status()).toBe(200)
		expect(await disabled.json()).toMatchObject({ description: null, plural: null })
		expect(await itemOf(cart.keyId)).toMatchObject({
			description: null,
			plural: null,
			translations: { [sk!.id]: { value: 'Máte {{count}} položiek' }, [en!.id]: { value: 'You have {{count}} items' } },
		})

		const taken = await patch({ name: 'orders.empty.title' })
		expect(taken.status()).toBe(409)
		expect((await readApiError(taken)).code).toBe('TRANSLATION_KEY_TAKEN')
		expect((await itemOf(cart.keyId)).name).toBe('orders.items')

		for (const [data, path] of [
			[{}, undefined],
			[{ name: '   ' }, 'name'],
			[{ name: 'x'.repeat(2001) }, 'name'],
			[{ description: 'x'.repeat(501) }, 'description'],
			[{ plural: { variable: '1count' } }, 'plural.variable'],
			[{ plural: { variable: 'a b' } }, 'plural.variable'],
		] as const) {
			const invalid = await patch(data)
			expect(invalid.status(), JSON.stringify(data).slice(0, 40)).toBe(400)
			const error = await readApiError(invalid)
			expect(error.code).toBe('VALIDATION_ERROR')
			if (path) {
				expect(error.details).toEqual([expect.objectContaining({ path, code: expect.any(String) })])
			}
		}
		expect(await itemOf(cart.keyId)).toMatchObject({ name: 'orders.items', description: null, plural: null })

		for (const keyId of [randomUUID(), 'not-a-uuid']) {
			const unknownKey = await request.patch(translationKeyApi(project.id, keyId), { data: { name: 'x' }, headers: MUTATION_HEADERS })
			expect(unknownKey.status(), keyId).toBe(404)
			expect((await readApiError(unknownKey)).code).toBe('TRANSLATION_KEY_NOT_FOUND')
		}

		const editor = await playwright.request.newContext({ baseURL, storageState: STORAGE_STATE.EDITOR })
		const [ownProject] = await listProjects(editor)
		const [ownSk] = await listLanguages(editor, ownProject!.id)
		await insertTranslationKeys(ownProject!.id, [ownSk!], [{ namespace: 'loc', name: 'nav.home', values: { sk: 'Domov' } }])
		const ownKey = (await listTranslations(editor, ownProject!.id)).items.find(({ name }) => name === 'nav.home')!
		const asMember = await editor.patch(translationKeyApi(ownProject!.id, ownKey.keyId), { data: { name: 'nav.start' }, headers: MUTATION_HEADERS })
		expect(asMember.status()).toBe(403)
		expect((await readApiError(asMember)).code).toBe('FORBIDDEN')
		expect((await listTranslations(editor, ownProject!.id)).items.map(({ name }) => name)).toEqual(['nav.home'])
		const asNonMember = await editor.patch(url, { data: { name: 'x' }, headers: MUTATION_HEADERS })
		expect(asNonMember.status()).toBe(404)
		expect((await readApiError(asNonMember)).code).toBe('NOT_FOUND')
		await editor.dispose()

		const withoutCsrfHeader = await request.patch(url, { data: { name: 'x' } })
		expect(withoutCsrfHeader.status()).toBe(403)
		expect((await readApiError(withoutCsrfHeader)).code).toBe('CSRF_REJECTED')

		const anonymous = await playwright.request.newContext({ baseURL, storageState: ANONYMOUS })
		const unauthenticated = await anonymous.patch(url, { data: { name: 'x' }, headers: MUTATION_HEADERS })
		expect(unauthenticated.status()).toBe(401)
		expect((await readApiError(unauthenticated)).code).toBe('AUTH_UNAUTHENTICATED')
		await anonymous.dispose()
		expect((await itemOf(cart.keyId)).name).toBe('orders.items')
	})
})

test.describe('/api/projects/:projectId/imports', () => {
	test.use({ storageState: STORAGE_STATE.ADMIN })

	test('previews and imports the sample file with the error contract for broken, oversized and fully skipped files', async ({
		request,
		playwright,
		baseURL,
	}) => {
		const project = await createProject(request, 'smoke-import', ['sk', 'en'])
		const [sk, en] = await listLanguages(request, project.id)
		const sample = { fileName: 'import-sample.csv', content: readFixture(SAMPLE_CSV) }

		const preview = await request.post(importPreviewApi(project.id), { data: sample, headers: MUTATION_HEADERS })
		expect(preview.status()).toBe(200)
		expect(await preview.json()).toEqual({
			columns: [
				{ tag: 'sk', columnIndex: 2, match: 'PROJECT', languageId: sk!.id, stats: { translations: 9, untranslated: 1, warnings: 1 } },
				{ tag: 'en', columnIndex: 3, match: 'PROJECT', languageId: en!.id, stats: { translations: 7, untranslated: 3, warnings: 0 } },
				{ tag: 'cs', columnIndex: 4, match: 'CATALOG', stats: { translations: 6, untranslated: 4, warnings: 1 } },
			],
			keys: { total: 10, new: 10, existing: 0 },
			namespaces: [
				{ namespace: 'loc', keys: 7 },
				{ namespace: 'paths', keys: 3 },
			],
			changes: [
				{ tag: 'sk', columnIndex: 2, new: 9, changed: 0, unchanged: 1, keptBecauseNull: 0 },
				{ tag: 'en', columnIndex: 3, new: 7, changed: 0, unchanged: 3, keptBecauseNull: 0 },
			],
			warnings: [
				{ code: 'LANGUAGE_NOT_IN_PROJECT', line: 1, column: 4, params: { tag: 'cs' } },
				{
					code: 'PLACEHOLDER_MISMATCH',
					line: 6,
					column: 4,
					params: { tag: 'cs', key: 'cart.items', namespace: 'loc', missing: '{{count}}', extra: '' },
				},
				{ code: 'BASE_LANGUAGE_UNTRANSLATED', line: 9, column: 2, params: { tag: 'sk', key: 'legal.terms', namespace: 'loc' } },
			],
			warningsTotal: 3,
		})
		const translations = () => request.get(projectTranslationsApi(project.id), { params: { sourceLanguageId: sk!.id, targetLanguageId: en!.id } })
		expect(await (await translations()).json()).toMatchObject({ stats: { totalKeys: 0 } })

		const columns = [
			{ columnIndex: 2, languageId: sk!.id },
			{ columnIndex: 3, languageId: en!.id },
			{ columnIndex: 4, languageId: null },
		]
		expect(await importFile(request, project.id, SAMPLE_CSV, columns)).toEqual({
			keysCreated: 10,
			translationsCreated: 16,
			translationsUpdated: 0,
			skippedColumns: 1,
		})
		expect(await importFile(request, project.id, SAMPLE_CSV, columns)).toEqual({
			keysCreated: 0,
			translationsCreated: 0,
			translationsUpdated: 0,
			skippedColumns: 1,
		})
		expect(await (await translations()).json()).toMatchObject({ stats: { totalKeys: 10, translated: 7, untranslated: 3 }, namespaces: ['loc', 'paths'] })

		const broken = { fileName: 'import-broken.csv', content: readFixture(BROKEN_CSV) }
		for (const url of [importPreviewApi(project.id), importApi(project.id)]) {
			const response = await request.post(url, { data: { ...broken, columns }, headers: MUTATION_HEADERS })
			expect(response.status(), url).toBe(422)
			const error = await readApiError(response)
			expect(error.code).toBe('IMPORT_FILE_INVALID')
			expect(error.details).toEqual({
				issues: [
					{ code: 'ROW_COLUMN_COUNT', line: 3, params: { expected: 3, actual: 4 } },
					{ code: 'ROW_EMPTY_KEY', line: 4, column: 1 },
				],
				total: 2,
			})
		}

		const tooLarge = await request.post(importPreviewApi(project.id), {
			data: { fileName: 'big.csv', content: `Keys; sk\n a; ${'x'.repeat(10 * 1024 * 1024)}\n` },
			headers: MUTATION_HEADERS,
		})
		expect(tooLarge.status()).toBe(413)
		expect((await readApiError(tooLarge)).code).toBe('IMPORT_FILE_TOO_LARGE')

		const allSkipped = await request.post(importApi(project.id), {
			data: { ...sample, columns: columns.map(({ columnIndex }) => ({ columnIndex, languageId: null })) },
			headers: MUTATION_HEADERS,
		})
		expect(allSkipped.status()).toBe(400)
		expect((await readApiError(allSkipped)).code).toBe('IMPORT_COLUMNS_INVALID')

		const notCsv = await request.post(importPreviewApi(project.id), { data: { ...sample, fileName: 'import-sample.txt' }, headers: MUTATION_HEADERS })
		expect(notCsv.status()).toBe(400)
		const notCsvError = await readApiError(notCsv)
		expect(notCsvError.code).toBe('VALIDATION_ERROR')
		expect(notCsvError.details).toEqual([expect.objectContaining({ path: 'fileName' })])

		const withoutCsrfHeader = await request.post(importPreviewApi(project.id), { data: sample })
		expect(withoutCsrfHeader.status()).toBe(403)
		expect((await readApiError(withoutCsrfHeader)).code).toBe('CSRF_REJECTED')

		const anonymous = await playwright.request.newContext({ baseURL, storageState: ANONYMOUS })
		for (const url of [importPreviewApi(project.id), importApi(project.id)]) {
			const unauthenticated = await anonymous.post(url, { data: { ...sample, columns }, headers: MUTATION_HEADERS })
			expect(unauthenticated.status(), url).toBe(401)
			expect((await readApiError(unauthenticated)).code).toBe('AUTH_UNAUTHENTICATED')
		}
		await anonymous.dispose()
	})
})
