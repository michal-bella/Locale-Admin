import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { ERROR_CODE, ROLE, VALIDATION_CODE, adminUserListResponseSchema, adminUserSchema, errorResponseSchema } from '@locale/shared'

import { verifyPassword } from '../src/lib/password'

import { createTestApp } from './helpers/app'
import { CSRF_HEADERS, loginAs } from './helpers/auth'
import { getTestPrisma } from './helpers/db'
import { TEST_PASSWORD, createUser } from './helpers/users'

const NEW_PASSWORD = 'NewUserPassword1'

type App = ReturnType<typeof createTestApp>

const expectErrorCode = (res: request.Response, status: number, code: ERROR_CODE) => {
	expect(res.status).toBe(status)
	expect(errorResponseSchema.parse(res.body).error.code).toBe(code)
}

const loginWithRole = async (app: App, role: ROLE) => {
	const { user } = await createUser({ role })
	return loginAs(app, { email: user.email, password: TEST_PASSWORD })
}

const postUser = (app: App, cookie: string, body: unknown) =>
	request(app)
		.post('/api/admin/users')
		.set('Cookie', cookie)
		.set(CSRF_HEADERS)
		.send(body as object)

describe('GET /api/admin/users', () => {
	it('returns users newest first without passwordHash', async () => {
		const app = createTestApp()
		const { user: admin } = await createUser({ role: ROLE.ADMIN, createdAt: new Date('2026-01-01T00:00:00Z') })
		const { user: older } = await createUser({ createdAt: new Date('2026-02-01T00:00:00Z') })
		const { user: newer } = await createUser({ createdAt: new Date('2026-03-01T00:00:00Z') })
		const cookie = await loginAs(app, { email: admin.email, password: TEST_PASSWORD })

		const res = await request(app).get('/api/admin/users').set('Cookie', cookie)

		expect(res.status).toBe(200)
		const { users } = adminUserListResponseSchema.parse(res.body)
		expect(users.map(({ id }) => id)).toEqual([newer.id, older.id, admin.id])
		expect(users[0]).toEqual({ id: newer.id, email: newer.email, role: ROLE.EDITOR, createdAt: '2026-03-01T00:00:00.000Z' })
		expect(adminUserListResponseSchema.extend({ users: adminUserSchema.strict().array() }).strict().safeParse(res.body).success).toBe(true)
		expect(JSON.stringify(res.body)).not.toContain('passwordHash')
	})

	it('returns 401 AUTH_UNAUTHENTICATED without a session', async () => {
		const res = await request(createTestApp()).get('/api/admin/users')

		expectErrorCode(res, 401, ERROR_CODE.AUTH_UNAUTHENTICATED)
	})

	it('returns 403 FORBIDDEN for an EDITOR', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.EDITOR)

		const res = await request(app).get('/api/admin/users').set('Cookie', cookie)

		expectErrorCode(res, 403, ERROR_CODE.FORBIDDEN)
	})
})

describe('POST /api/admin/users', () => {
	it('creates an EDITOR with a normalized email even when the body asks for ADMIN', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)
		const before = Date.now()

		const res = await postUser(app, cookie, { email: '  Nova.Osoba@Firma.SK ', password: NEW_PASSWORD, role: ROLE.ADMIN })

		expect(res.status).toBe(201)
		const body = adminUserSchema.strict().parse(res.body)
		expect(body).toMatchObject({ email: 'nova.osoba@firma.sk', role: ROLE.EDITOR })

		const stored = await getTestPrisma().user.findUniqueOrThrow({ where: { id: body.id } })
		expect(stored).toMatchObject({ email: 'nova.osoba@firma.sk', role: ROLE.EDITOR, isActive: true })
		expect(stored.passwordHash).toMatch(/^\$argon2id\$/)
		expect(await verifyPassword(stored.passwordHash, NEW_PASSWORD)).toBe(true)
		expect(stored.passwordChangedAt.getTime()).toBeGreaterThanOrEqual(before - 1000)
		expect(body.createdAt).toBe(stored.createdAt.toISOString())
	})

	it('creates a user who can log in', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)
		await postUser(app, cookie, { email: 'nova.osoba@firma.sk', password: NEW_PASSWORD }).expect(201)

		const res = await request(app).post('/api/auth/login').set(CSRF_HEADERS).send({ email: 'NOVA.osoba@firma.sk', password: NEW_PASSWORD })

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({ email: 'nova.osoba@firma.sk', role: ROLE.EDITOR })
	})

	it.each([
		{ name: 'invalid email', body: { email: 'not-an-email', password: NEW_PASSWORD }, details: [{ path: 'email', code: VALIDATION_CODE.INVALID_EMAIL }] },
		{
			name: 'short password',
			body: { email: 'nova.osoba@firma.sk', password: 'short' },
			details: [{ path: 'password', code: VALIDATION_CODE.TOO_SHORT, params: { min: 8 } }],
		},
		{
			name: 'missing fields',
			body: {},
			details: [
				{ path: 'email', code: VALIDATION_CODE.REQUIRED },
				{ path: 'password', code: VALIDATION_CODE.REQUIRED },
			],
		},
	])('returns 400 VALIDATION_ERROR with details for $name', async ({ body, details }) => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)

		const res = await postUser(app, cookie, body)

		expectErrorCode(res, 400, ERROR_CODE.VALIDATION_ERROR)
		expect(errorResponseSchema.parse(res.body).error.details).toEqual(details)
		expect(await getTestPrisma().user.count()).toBe(1)
	})

	it('returns 409 EMAIL_TAKEN for an existing email in different case', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)
		await createUser({ email: 'existujuci@firma.sk' })

		const res = await postUser(app, cookie, { email: 'Existujuci@FIRMA.sk', password: NEW_PASSWORD })

		expectErrorCode(res, 409, ERROR_CODE.EMAIL_TAKEN)
		expect(await getTestPrisma().user.count({ where: { email: 'existujuci@firma.sk' } })).toBe(1)
	})

	it('returns 409 EMAIL_TAKEN for one of two concurrent requests with the same email', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)

		const responses = await Promise.all([
			postUser(app, cookie, { email: 'subeh@firma.sk', password: NEW_PASSWORD }),
			postUser(app, cookie, { email: 'subeh@firma.sk', password: NEW_PASSWORD }),
		])

		expect(responses.map(({ status }) => status).sort()).toEqual([201, 409])
		expectErrorCode(responses.find(({ status }) => status === 409) as request.Response, 409, ERROR_CODE.EMAIL_TAKEN)
	})

	it('returns 401 AUTH_UNAUTHENTICATED without a session', async () => {
		const res = await request(createTestApp()).post('/api/admin/users').set(CSRF_HEADERS).send({ email: 'nova.osoba@firma.sk', password: NEW_PASSWORD })

		expectErrorCode(res, 401, ERROR_CODE.AUTH_UNAUTHENTICATED)
		expect(await getTestPrisma().user.count()).toBe(0)
	})

	it('returns 403 FORBIDDEN for an EDITOR', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.EDITOR)

		const res = await postUser(app, cookie, { email: 'nova.osoba@firma.sk', password: NEW_PASSWORD })

		expectErrorCode(res, 403, ERROR_CODE.FORBIDDEN)
		expect(await getTestPrisma().user.count()).toBe(1)
	})

	it('returns 403 CSRF_REJECTED without X-Requested-With', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)

		const res = await request(app).post('/api/admin/users').set('Cookie', cookie).send({ email: 'nova.osoba@firma.sk', password: NEW_PASSWORD })

		expectErrorCode(res, 403, ERROR_CODE.CSRF_REJECTED)
		expect(await getTestPrisma().user.count()).toBe(1)
	})
})
