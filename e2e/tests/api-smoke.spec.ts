import { type APIRequestContext, expect, test } from '@playwright/test'

import { type AdminUser, MUTATION_HEADERS, readApiError } from '../support/api'
import { ANONYMOUS, STORAGE_STATE } from '../support/auth'
import {
	acquireLanguagesLock,
	deleteLanguageIfPresent,
	deleteLeftoverTestLanguages,
	type Language,
	LANGUAGES_API,
	listLanguages,
	newAdminApi,
	TEST_LANGUAGE,
} from '../support/languages'
import { createEditor, newTestEditorCredentials } from '../support/users'

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

		const create = await request.post('/api/admin/users', { data: newTestEditorCredentials(), headers: MUTATION_HEADERS })
		expect(create.status()).toBe(401)
		expect((await readApiError(create)).code).toBe('AUTH_UNAUTHENTICATED')
	})
})

test.describe('ADMIN /api/admin/users', () => {
	test.use({ storageState: STORAGE_STATE.ADMIN })

	test('POST creates an EDITOR with a normalized email even when the body asks for ADMIN', async ({ request }) => {
		const credentials = newTestEditorCredentials()
		const response = await request.post('/api/admin/users', {
			data: { ...credentials, email: `  ${credentials.email.toUpperCase()} `, role: 'ADMIN' },
			headers: MUTATION_HEADERS,
		})
		expect(response.status()).toBe(201)
		const body = (await response.json()) as Record<string, unknown>
		expect(body).toEqual({ id: expect.any(String), email: credentials.email, role: 'EDITOR', createdAt: expect.any(String) })
		expect(new Date(body.createdAt as string).toISOString()).toBe(body.createdAt)

		const users = ((await (await request.get('/api/admin/users')).json()) as { users: AdminUser[] }).users
		expect(users.find(({ id }) => id === body.id)).toEqual(body)
		const createdAts = users.map(({ createdAt }) => createdAt)
		expect(createdAts).toEqual([...createdAts].sort().reverse())
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
			data: { email: existing.email.toUpperCase(), password: newTestEditorCredentials().password },
			headers: MUTATION_HEADERS,
		})
		expect(response.status()).toBe(409)
		expect((await readApiError(response)).code).toBe('EMAIL_TAKEN')
	})

	test('POST without X-Requested-With returns 403 CSRF_REJECTED and creates nothing', async ({ request }) => {
		const credentials = newTestEditorCredentials()
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

		const credentials = newTestEditorCredentials()
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

test.describe('anonymous /api/admin/languages', () => {
	test.use({ storageState: ANONYMOUS })

	test('GET and POST return 401 AUTH_UNAUTHENTICATED', async ({ request }) => {
		const list = await request.get(LANGUAGES_API)
		expect(list.status()).toBe(401)
		expect((await readApiError(list)).code).toBe('AUTH_UNAUTHENTICATED')

		const create = await request.post(LANGUAGES_API, { data: { tag: TEST_LANGUAGE.apiSmoke.tag }, headers: MUTATION_HEADERS })
		expect(create.status()).toBe(401)
		expect((await readApiError(create)).code).toBe('AUTH_UNAUTHENTICATED')
	})
})

test.describe('EDITOR /api/admin/languages', () => {
	test.use({ storageState: STORAGE_STATE.EDITOR })

	test('GET, POST and DELETE return 403 FORBIDDEN', async ({ request, playwright }) => {
		const list = await request.get(LANGUAGES_API)
		expect(list.status()).toBe(403)
		expect((await readApiError(list)).code).toBe('FORBIDDEN')

		const create = await request.post(LANGUAGES_API, { data: { tag: TEST_LANGUAGE.apiSmoke.tag }, headers: MUTATION_HEADERS })
		expect(create.status()).toBe(403)
		expect((await readApiError(create)).code).toBe('FORBIDDEN')

		const admin = await newAdminApi(playwright.request)
		const [first] = await listLanguages(admin)
		await admin.dispose()
		expect(first, 'at least one language (seed adds sk and en)').toBeDefined()
		const remove = await request.delete(`${LANGUAGES_API}/${first!.id}`, { data: {}, headers: MUTATION_HEADERS })
		expect(remove.status()).toBe(403)
		expect((await readApiError(remove)).code).toBe('FORBIDDEN')
	})
})

test.describe('ADMIN /api/admin/languages', () => {
	// Shares the catalog and the base flag with languages.spec.ts; the lock keeps the base from moving during these checks.
	test.describe.configure({ mode: 'serial' })
	test.use({ storageState: STORAGE_STATE.ADMIN })

	const { tag, englishName, nativeName, flagCode } = TEST_LANGUAGE.apiSmoke
	let releaseLock: (() => Promise<void>) | undefined
	let created: Language

	test.beforeAll(async ({ playwright }) => {
		test.setTimeout(180_000)
		releaseLock = await acquireLanguagesLock()
		const api = await newAdminApi(playwright.request)
		await deleteLeftoverTestLanguages(api)
		await api.dispose()
	})

	test.afterAll(async ({ playwright }) => {
		try {
			const api = await newAdminApi(playwright.request)
			await deleteLanguageIfPresent(api, tag)
			await api.dispose()
		} finally {
			await releaseLock?.()
		}
	})

	test('GET lists exactly one base language first, the rest sorted by tag', async ({ request }) => {
		const languages = await listLanguages(request)
		expect(languages.filter(({ isBase }) => isBase)).toHaveLength(1)
		expect(languages[0]!.isBase).toBe(true)
		const rest = languages.slice(1).map((language) => language.tag)
		expect(rest).toEqual([...rest].sort())
		for (const language of languages) {
			expect(language).toEqual({
				id: expect.any(String),
				tag: expect.any(String),
				englishName: expect.any(String),
				nativeName: expect.any(String),
				flagCode: expect.any(String),
				isBase: expect.any(Boolean),
				createdAt: expect.any(String),
			})
		}
	})

	test('POST without X-Requested-With returns 403 CSRF_REJECTED and adds nothing', async ({ request }) => {
		const response = await request.post(LANGUAGES_API, { data: { tag } })
		expect(response.status()).toBe(403)
		expect((await readApiError(response)).code).toBe('CSRF_REJECTED')
		expect((await listLanguages(request)).map((language) => language.tag)).not.toContain(tag)
	})

	test('POST with a tag outside the catalog or without a tag returns 400', async ({ request }) => {
		for (const data of [{ tag: 'xx' }, {}]) {
			const response = await request.post(LANGUAGES_API, { data, headers: MUTATION_HEADERS })
			expect(response.status()).toBe(400)
			const error = await readApiError(response)
			expect(error.code).toBe('VALIDATION_ERROR')
			expect(error.details).toEqual([{ path: 'tag', code: 'INVALID' }])
		}
	})

	test('POST adds a language with names and flag from the catalog (201), a second POST returns 409 LANGUAGE_TAKEN', async ({ request }) => {
		const response = await request.post(LANGUAGES_API, { data: { tag, englishName: 'Ignored', isBase: true }, headers: MUTATION_HEADERS })
		expect(response.status()).toBe(201)
		created = (await response.json()) as Language
		expect(created).toEqual({ id: expect.any(String), tag, englishName, nativeName, flagCode, isBase: false, createdAt: expect.any(String) })
		expect((await listLanguages(request)).find(({ id }) => id === created.id)).toEqual(created)

		const duplicate = await request.post(LANGUAGES_API, { data: { tag }, headers: MUTATION_HEADERS })
		expect(duplicate.status()).toBe(409)
		expect((await readApiError(duplicate)).code).toBe('LANGUAGE_TAKEN')
	})

	test('PATCH saves trimmed names and ignores the tag; invalid body returns 400, missing CSRF header 403', async ({ request }) => {
		const url = `${LANGUAGES_API}/${created.id}`
		const update = await request.patch(url, {
			data: { englishName: '  Romanian E2E ', nativeName: 'română', flagCode: 'ro', tag: 'bg' },
			headers: MUTATION_HEADERS,
		})
		expect(update.status()).toBe(200)
		const expected = { ...created, englishName: 'Romanian E2E' }
		expect(await update.json()).toEqual(expected)

		const invalid = await request.patch(url, {
			data: { englishName: ' ', nativeName: 'a'.repeat(101), flagCode: 'us', isBase: false },
			headers: MUTATION_HEADERS,
		})
		expect(invalid.status()).toBe(400)
		const error = await readApiError(invalid)
		expect(error.code).toBe('VALIDATION_ERROR')
		expect(error.details).toEqual(
			expect.arrayContaining([
				{ path: 'englishName', code: 'REQUIRED' },
				{ path: 'nativeName', code: 'TOO_LONG', params: { max: 100 } },
				{ path: 'flagCode', code: 'INVALID' },
				{ path: 'isBase', code: 'INVALID' },
			]),
		)

		const withoutCsrfHeader = await request.patch(url, { data: { englishName: 'X', nativeName: 'Y', flagCode: 'ro' } })
		expect(withoutCsrfHeader.status()).toBe(403)
		expect((await readApiError(withoutCsrfHeader)).code).toBe('CSRF_REJECTED')
		expect((await listLanguages(request)).find(({ id }) => id === created.id)).toEqual(expected)
	})

	test('DELETE of the base language returns 409 LANGUAGE_IS_BASE and keeps it', async ({ request }) => {
		const base = (await listLanguages(request)).find(({ isBase }) => isBase)
		expect(base, 'a base language').toBeDefined()
		const response = await request.delete(`${LANGUAGES_API}/${base!.id}`, { data: {}, headers: MUTATION_HEADERS })
		expect(response.status()).toBe(409)
		expect((await readApiError(response)).code).toBe('LANGUAGE_IS_BASE')
		expect((await listLanguages(request)).find(({ id }) => id === base!.id)?.isBase).toBe(true)
	})

	test('DELETE without X-Requested-With returns 403, then 204, then 404 for the same and a non-UUID id', async ({ request }) => {
		const url = `${LANGUAGES_API}/${created.id}`
		const withoutCsrfHeader = await request.delete(url, { data: {} })
		expect(withoutCsrfHeader.status()).toBe(403)
		expect((await readApiError(withoutCsrfHeader)).code).toBe('CSRF_REJECTED')

		const response = await request.delete(url, { data: {}, headers: MUTATION_HEADERS })
		expect(response.status()).toBe(204)
		expect(await response.text()).toBe('')
		expect((await listLanguages(request)).map((language) => language.id)).not.toContain(created.id)

		for (const missing of [url, `${LANGUAGES_API}/not-a-uuid`]) {
			const notFound = await request.delete(missing, { data: {}, headers: MUTATION_HEADERS })
			expect(notFound.status()).toBe(404)
			expect((await readApiError(notFound)).code).toBe('NOT_FOUND')
		}
		const patchMissing = await request.patch(url, { data: { englishName, nativeName, flagCode }, headers: MUTATION_HEADERS })
		expect(patchMissing.status()).toBe(404)
		expect((await readApiError(patchMissing)).code).toBe('NOT_FOUND')
	})
})
