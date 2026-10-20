import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { ERROR_CODE, ROLE, VALIDATION_CODE, authUserSchema, errorResponseSchema } from '@locale/shared'

import { hashSessionToken } from '../src/services/session.service'

import { createTestApp } from './helpers/app'
import { CSRF_HEADERS, findSessionByCookie, getSessionSetCookie, loginAs } from './helpers/auth'
import { getTestPrisma } from './helpers/db'
import { TEST_PASSWORD, createUser } from './helpers/users'

const SEVEN_DAYS_S = 7 * 24 * 60 * 60

const postLogin = (app: ReturnType<typeof createTestApp>, body: unknown) =>
	request(app)
		.post('/api/auth/login')
		.set(CSRF_HEADERS)
		.send(body as object)

const expectErrorCode = (res: request.Response, status: number, code: ERROR_CODE) => {
	expect(res.status).toBe(status)
	expect(errorResponseSchema.parse(res.body).error.code).toBe(code)
}

describe('POST /api/auth/login', () => {
	it('returns the AuthUser and sets the session cookie', async () => {
		const { user } = await createUser({ role: ROLE.ADMIN, email: 'meno@firma.sk', firstName: 'Meno', lastName: 'Priezvisko' })

		const res = await postLogin(createTestApp(), { email: 'meno@firma.sk', password: TEST_PASSWORD })

		expect(res.status).toBe(200)
		expect(res.body).toEqual({
			id: user.id,
			email: 'meno@firma.sk',
			role: ROLE.ADMIN,
			firstName: 'Meno',
			lastName: 'Priezvisko',
			preferences: { translationsView: 'EXTENDED', translationsLayout: 'COLUMNS' },
		})
		expect(authUserSchema.strict().safeParse(res.body).success).toBe(true)

		const cookie = getSessionSetCookie(res)
		expect(cookie?.value).toMatch(/^[\w-]{43}$/)
		expect(cookie?.attributes).toMatchObject({ httponly: true, samesite: 'Lax', path: '/' })
		expect(cookie?.attributes.secure).toBeUndefined()
		expect(Number(cookie?.attributes['max-age'])).toBeGreaterThanOrEqual(SEVEN_DAYS_S - 2)
		expect(Number(cookie?.attributes['max-age'])).toBeLessThanOrEqual(SEVEN_DAYS_S)
	})

	it('stores only the SHA-256 hash of the token', async () => {
		const { user } = await createUser()

		const res = await postLogin(createTestApp(), { email: user.email, password: TEST_PASSWORD })

		const token = getSessionSetCookie(res)?.value ?? ''
		const sessions = await getTestPrisma().session.findMany({ where: { userId: user.id } })
		expect(sessions).toHaveLength(1)
		expect(sessions[0]?.tokenHash).toBe(hashSessionToken(token))
		expect(sessions[0]?.tokenHash).not.toBe(token)
		expect(JSON.stringify(res.body)).not.toContain(token)
	})

	it('sets the Secure attribute when cookieSecure is true', async () => {
		const { user } = await createUser()

		const res = await postLogin(createTestApp({ config: { cookieSecure: true } }), { email: user.email, password: TEST_PASSWORD })

		expect(res.status).toBe(200)
		expect(getSessionSetCookie(res)?.attributes.secure).toBe(true)
	})

	it('accepts the email in a different case and sets lastLoginAt', async () => {
		const { user } = await createUser({ email: 'michal.bella@goodrequest.com' })
		expect(user.lastLoginAt).toBeNull()

		const res = await postLogin(createTestApp(), { email: '  Michal.Bella@GoodRequest.com ', password: TEST_PASSWORD })

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({ email: 'michal.bella@goodrequest.com' })
		const updated = await getTestPrisma().user.findUniqueOrThrow({ where: { id: user.id } })
		expect(updated.lastLoginAt).toBeInstanceOf(Date)
		expect(Date.now() - (updated.lastLoginAt?.getTime() ?? 0)).toBeLessThan(10_000)
	})

	it.each([
		['wrong password', { password: 'WrongPassword123' }],
		['unknown email', { email: 'nobody@example.com' }],
	])('returns 401 AUTH_INVALID_CREDENTIALS for a %s', async (_name, override) => {
		const { user } = await createUser()

		const res = await postLogin(createTestApp(), { email: user.email, password: TEST_PASSWORD, ...override })

		expectErrorCode(res, 401, ERROR_CODE.AUTH_INVALID_CREDENTIALS)
		expect(getSessionSetCookie(res)).toBeUndefined()
		expect(await getTestPrisma().session.count()).toBe(0)
	})

	it('returns 401 AUTH_INVALID_CREDENTIALS for an inactive user with the right password', async () => {
		const { user } = await createUser({ isActive: false })

		const res = await postLogin(createTestApp(), { email: user.email, password: TEST_PASSWORD })

		expectErrorCode(res, 401, ERROR_CODE.AUTH_INVALID_CREDENTIALS)
		expect(await getTestPrisma().session.count()).toBe(0)
		expect((await getTestPrisma().user.findUniqueOrThrow({ where: { id: user.id } })).lastLoginAt).toBeNull()
	})

	it('returns 400 VALIDATION_ERROR with details for an invalid body', async () => {
		const res = await postLogin(createTestApp(), { email: 'not-an-email', password: '' })

		expectErrorCode(res, 400, ERROR_CODE.VALIDATION_ERROR)
		expect(errorResponseSchema.parse(res.body).error.details).toEqual([
			{ path: 'email', code: VALIDATION_CODE.INVALID_EMAIL },
			{ path: 'password', code: VALIDATION_CODE.REQUIRED },
		])
	})

	it('deletes expired sessions of all users', async () => {
		const app = createTestApp()
		const { user: other } = await createUser()
		const { user } = await createUser()
		const prisma = getTestPrisma()
		const past = new Date(Date.now() - 60_000)
		const future = new Date(Date.now() + 60_000)
		await prisma.session.createMany({
			data: [
				{ userId: other.id, tokenHash: 'expired-1', expiresAt: past },
				{ userId: user.id, tokenHash: 'expired-2', expiresAt: past },
				{ userId: other.id, tokenHash: 'still-valid', expiresAt: future },
			],
		})

		await loginAs(app, { email: user.email, password: TEST_PASSWORD })

		const remaining = await prisma.session.findMany({ select: { tokenHash: true } })
		expect(remaining.map(({ tokenHash }) => tokenHash)).not.toContain('expired-1')
		expect(remaining.map(({ tokenHash }) => tokenHash)).not.toContain('expired-2')
		expect(remaining.map(({ tokenHash }) => tokenHash)).toContain('still-valid')
		expect(remaining).toHaveLength(2)
	})

	it('replaces the session of a still-valid cookie sent with the login', async () => {
		const app = createTestApp()
		const { user } = await createUser()
		const oldCookie = await loginAs(app, { email: user.email, password: TEST_PASSWORD })
		const otherBrowserCookie = await loginAs(app, { email: user.email, password: TEST_PASSWORD })

		const res = await postLogin(app, { email: user.email, password: TEST_PASSWORD }).set('Cookie', oldCookie)

		expect(res.status).toBe(200)
		expect(await findSessionByCookie(oldCookie)).toBeNull()
		expect(await findSessionByCookie(otherBrowserCookie)).not.toBeNull()
		const newToken = getSessionSetCookie(res)?.value ?? ''
		const sessions = await getTestPrisma().session.findMany({ where: { userId: user.id }, select: { tokenHash: true } })
		expect(sessions.map(({ tokenHash }) => tokenHash).sort()).toEqual(
			[hashSessionToken(newToken), hashSessionToken(otherBrowserCookie.split('=')[1] ?? '')].sort(),
		)
	})

	it('returns 429 RATE_LIMITED with Retry-After after the limit, counting every attempt', async () => {
		const app = createTestApp({ config: { loginRateLimitMax: 3, loginRateLimitWindowMs: 60_000 } })
		const { user } = await createUser()

		expect((await postLogin(app, { email: user.email, password: TEST_PASSWORD })).status).toBe(200)
		expect((await postLogin(app, { email: user.email, password: 'WrongPassword123' })).status).toBe(401)
		expect((await postLogin(app, { email: 'not-an-email', password: 'x' })).status).toBe(400)
		const res = await postLogin(app, { email: user.email, password: TEST_PASSWORD })

		expectErrorCode(res, 429, ERROR_CODE.RATE_LIMITED)
		const retryAfter = Number(res.headers['retry-after'])
		expect(retryAfter).toBeGreaterThan(0)
		expect(retryAfter).toBeLessThanOrEqual(60)
		expect(getSessionSetCookie(res)).toBeUndefined()
	})

	it('keeps a separate rate limit store per app instance', async () => {
		const { user } = await createUser()
		const limited = createTestApp({ config: { loginRateLimitMax: 1 } })
		await postLogin(limited, { email: user.email, password: TEST_PASSWORD })
		expect((await postLogin(limited, { email: user.email, password: TEST_PASSWORD })).status).toBe(429)

		expect((await postLogin(createTestApp({ config: { loginRateLimitMax: 1 } }), { email: user.email, password: TEST_PASSWORD })).status).toBe(200)
	})
})

describe('GET /api/auth/me', () => {
	it('returns 401 AUTH_UNAUTHENTICATED without a cookie', async () => {
		expectErrorCode(await request(createTestApp()).get('/api/auth/me'), 401, ERROR_CODE.AUTH_UNAUTHENTICATED)
	})

	it('returns 401 AUTH_UNAUTHENTICATED for an unknown token', async () => {
		const res = await request(createTestApp()).get('/api/auth/me').set('Cookie', 'locale_session=unknown-token')

		expectErrorCode(res, 401, ERROR_CODE.AUTH_UNAUTHENTICATED)
	})

	it('returns the AuthUser with a valid cookie', async () => {
		const app = createTestApp()
		const { user } = await createUser({ role: ROLE.EDITOR })
		const cookie = await loginAs(app, { email: user.email, password: TEST_PASSWORD })

		const res = await request(app).get('/api/auth/me').set('Cookie', cookie)

		expect(res.status).toBe(200)
		expect(res.body).toEqual({
			id: user.id,
			email: user.email,
			role: ROLE.EDITOR,
			firstName: null,
			lastName: null,
			preferences: { translationsView: 'EXTENDED', translationsLayout: 'COLUMNS' },
		})
		expect(getSessionSetCookie(res)).toBeUndefined()
	})
})

describe('POST /api/auth/logout', () => {
	it('deletes the session, clears the cookie and the old cookie gets 401', async () => {
		const app = createTestApp()
		const { user } = await createUser()
		const cookie = await loginAs(app, { email: user.email, password: TEST_PASSWORD })
		expect(await findSessionByCookie(cookie)).not.toBeNull()

		const res = await request(app).post('/api/auth/logout').set(CSRF_HEADERS).set('Cookie', cookie).send({})

		expect(res.status).toBe(204)
		const cleared = getSessionSetCookie(res)
		expect(cleared?.value).toBe('')
		expect(cleared?.attributes).toMatchObject({ httponly: true, samesite: 'Lax', path: '/' })
		expect(new Date(String(cleared?.attributes.expires)).getTime()).toBeLessThan(Date.now())
		expect(await findSessionByCookie(cookie)).toBeNull()

		expectErrorCode(await request(app).get('/api/auth/me').set('Cookie', cookie), 401, ERROR_CODE.AUTH_UNAUTHENTICATED)
	})

	it('returns 204 without a session (idempotent)', async () => {
		const res = await request(createTestApp()).post('/api/auth/logout').set(CSRF_HEADERS).send({})

		expect(res.status).toBe(204)
		expect(getSessionSetCookie(res)?.value).toBe('')
	})

	it('keeps other sessions of the same user', async () => {
		const app = createTestApp()
		const { user } = await createUser()
		const first = await loginAs(app, { email: user.email, password: TEST_PASSWORD })
		const second = await loginAs(app, { email: user.email, password: TEST_PASSWORD })

		await request(app).post('/api/auth/logout').set(CSRF_HEADERS).set('Cookie', first).send({})

		expect((await request(app).get('/api/auth/me').set('Cookie', second)).status).toBe(200)
	})
})
