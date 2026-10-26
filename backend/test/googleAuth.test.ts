import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { authProvidersResponseSchema, authUserSchema, ERROR_CODE, errorResponseSchema, projectListResponseSchema, ROLE } from '@locale/shared'

import { type GoogleIdentity, type GoogleOidc } from '../src/lib/googleOidc'
import { OAUTH_COOKIE_NAME } from '../src/lib/oauthCookie'

import { createTestApp } from './helpers/app'
import { CSRF_HEADERS, getSessionSetCookie, loginAs, toCookieHeader } from './helpers/auth'
import { getTestPrisma } from './helpers/db'
import { TEST_PASSWORD, createUser } from './helpers/users'

type App = ReturnType<typeof createTestApp>

const GOOGLE_IDENTITY: GoogleIdentity = {
	sub: 'google-sub-1',
	email: 'Jana.Novakova@Gmail.com',
	emailVerified: true,
	givenName: 'Jana',
	familyName: 'Nováková',
}

/** Stands in for Google: the authorization URL carries the state, the callback must return it like Google does. */
const createFakeGoogle = (identity: Partial<GoogleIdentity> = {}): GoogleOidc => ({
	createAuthorizationUrl: ({ state }) => Promise.resolve(new URL(`https://accounts.google.test/auth?state=${state}`)),
	exchangeCode: (params, checks) => {
		if (params.get('state') !== checks.state || params.get('code') !== 'google-code') {
			return Promise.reject(new Error('Invalid authorization response'))
		}
		return Promise.resolve({ ...GOOGLE_IDENTITY, ...identity })
	},
})

const getCookieValue = (res: request.Response, name: string): string | undefined => {
	const header = res.headers['set-cookie'] as string[] | string | undefined
	const raw = [header ?? []].flat().find((cookie) => cookie.startsWith(`${name}=`))
	return raw?.split(';')[0]?.slice(name.length + 1)
}

/** Runs the whole redirect dance and returns the callback response. */
const signInWithGoogle = async (app: App, { cookie, state }: { cookie?: string; state?: string } = {}) => {
	const start = await request(app).get('/api/auth/oauth/google')
	const oauthCookie = getCookieValue(start, OAUTH_COOKIE_NAME)
	const returnedState = state ?? new URL(start.headers.location as string).searchParams.get('state')
	const cookies = [oauthCookie && `${OAUTH_COOKIE_NAME}=${oauthCookie}`, cookie].filter(Boolean).join('; ')
	return request(app).get(`/api/auth/oauth/google/callback?code=google-code&state=${returnedState}`).set('Cookie', cookies)
}

const expectLoginError = (res: request.Response, code: string) => {
	expect(res.status).toBe(303)
	expect(res.headers.location).toBe(`/login?error=${code}`)
	expect(getSessionSetCookie(res)).toBeUndefined()
}

describe('GET /api/auth/providers', () => {
	it('reports Google off without the GOOGLE_* configuration and on with it', async () => {
		const off = await request(createTestApp()).get('/api/auth/providers')
		expect(off.status).toBe(200)
		expect(authProvidersResponseSchema.strict().parse(off.body)).toEqual({ google: false })

		const on = await request(createTestApp({ googleOidc: createFakeGoogle() })).get('/api/auth/providers')
		expect(on.body).toEqual({ google: true })
	})
})

describe('GET /api/auth/oauth/google', () => {
	it('returns 404 when Google sign-in is off', async () => {
		const app = createTestApp()
		expect((await request(app).get('/api/auth/oauth/google')).status).toBe(404)
		expect((await request(app).get('/api/auth/oauth/google/callback?code=x&state=y')).status).toBe(404)
	})

	it('redirects to Google and keeps the checks in a short-lived httpOnly cookie for the OAuth paths only', async () => {
		const res = await request(createTestApp({ googleOidc: createFakeGoogle() })).get('/api/auth/oauth/google')

		expect(res.status).toBe(302)
		expect(res.headers.location).toMatch(/^https:\/\/accounts\.google\.test\/auth\?state=/)
		const raw = [res.headers['set-cookie'] as string[] | string].flat().find((cookie) => cookie.startsWith(`${OAUTH_COOKIE_NAME}=`))
		expect(raw).toMatch(/HttpOnly/)
		expect(raw).toMatch(/SameSite=Lax/)
		expect(raw).toMatch(/Path=\/api\/auth\/oauth/)
		expect(raw).toMatch(/Max-Age=600/)
	})

	it('redirects to the login page with AUTH_OAUTH_FAILED when Google is unreachable', async () => {
		const google: GoogleOidc = { ...createFakeGoogle(), createAuthorizationUrl: () => Promise.reject(new Error('discovery failed')) }

		const res = await request(createTestApp({ googleOidc: google })).get('/api/auth/oauth/google')

		expectLoginError(res, 'AUTH_OAUTH_FAILED')
	})
})

describe('GET /api/auth/oauth/google/callback', () => {
	it('creates a USER without projects and without a password on the first sign-in and signs them in', async () => {
		const app = createTestApp({ googleOidc: createFakeGoogle() })

		const res = await signInWithGoogle(app)

		expect(res.status).toBe(303)
		expect(res.headers.location).toBe('/')
		expect(getCookieValue(res, OAUTH_COOKIE_NAME)).toBe('')
		const session = getSessionSetCookie(res)
		expect(session).toBeDefined()
		const user = await getTestPrisma().user.findUniqueOrThrow({ where: { email: 'jana.novakova@gmail.com' }, include: { projectMemberships: true } })
		expect(user).toMatchObject({
			role: ROLE.USER,
			googleSub: 'google-sub-1',
			passwordHash: null,
			passwordChangedAt: null,
			firstName: 'Jana',
			lastName: 'Nováková',
		})
		expect(user.lastLoginAt).not.toBeNull()
		expect(user.projectMemberships).toEqual([])

		const me = await request(app)
			.get('/api/auth/me')
			.set('Cookie', toCookieHeader(session?.value ?? ''))
		expect(authUserSchema.parse(me.body)).toMatchObject({ id: user.id, role: ROLE.USER })
		const projects = await request(app)
			.get('/api/projects')
			.set('Cookie', toCookieHeader(session?.value ?? ''))
		expect(projects.status).toBe(200)
		expect(projectListResponseSchema.parse(projects.body).projects).toEqual([])
	})

	it('finds the user by the Google ID next time and keeps names and email the user or an admin changed', async () => {
		const app = createTestApp({ googleOidc: createFakeGoogle() })
		await signInWithGoogle(app)
		const prisma = getTestPrisma()
		await prisma.user.update({ where: { googleSub: 'google-sub-1' }, data: { firstName: 'Janka', email: 'jana@firma.sk' } })

		const res = await signInWithGoogle(createTestApp({ googleOidc: createFakeGoogle({ email: 'jana.nova@gmail.com' }) }))

		expect(res.headers.location).toBe('/')
		expect(await prisma.user.count()).toBe(1)
		expect(await prisma.user.findUniqueOrThrow({ where: { googleSub: 'google-sub-1' } })).toMatchObject({
			email: 'jana@firma.sk',
			firstName: 'Janka',
			lastName: 'Nováková',
		})
	})

	it('links the Google account to an existing user with the same email and keeps their password', async () => {
		const { user } = await createUser({ email: 'jana.novakova@gmail.com', firstName: 'Jana', role: ROLE.ADMIN })
		const app = createTestApp({ googleOidc: createFakeGoogle({ givenName: 'Iné' }) })

		const res = await signInWithGoogle(app)

		expect(res.headers.location).toBe('/')
		expect(await getTestPrisma().user.findUniqueOrThrow({ where: { id: user.id } })).toMatchObject({
			googleSub: 'google-sub-1',
			role: ROLE.ADMIN,
			firstName: 'Jana',
			lastName: 'Nováková',
			passwordHash: user.passwordHash,
		})
		await expect(loginAs(app, { email: user.email, password: TEST_PASSWORD })).resolves.toBeTruthy()
	})

	it('replaces the session sent with the callback', async () => {
		const { user } = await createUser({ email: 'jana.novakova@gmail.com' })
		const app = createTestApp({ googleOidc: createFakeGoogle() })
		const previous = await loginAs(app, { email: user.email, password: TEST_PASSWORD })

		await signInWithGoogle(app, { cookie: previous })

		expect(await getTestPrisma().session.count({ where: { userId: user.id } })).toBe(1)
		expect((await request(app).get('/api/auth/me').set('Cookie', previous)).status).toBe(401)
	})

	it('rejects a Google account without a verified email and creates nothing', async () => {
		const res = await signInWithGoogle(createTestApp({ googleOidc: createFakeGoogle({ emailVerified: false }) }))

		expectLoginError(res, 'AUTH_EMAIL_NOT_VERIFIED')
		expect(await getTestPrisma().user.count()).toBe(0)
	})

	it('rejects an email whose user is linked to another Google account', async () => {
		await createUser({ email: 'jana.novakova@gmail.com', googleSub: 'google-sub-other' })

		const res = await signInWithGoogle(createTestApp({ googleOidc: createFakeGoogle() }))

		expectLoginError(res, 'AUTH_ACCOUNT_CONFLICT')
		expect(await getTestPrisma().user.count()).toBe(1)
	})

	it('rejects a blocked user with AUTH_USER_BLOCKED', async () => {
		await createUser({ email: 'jana.novakova@gmail.com', googleSub: 'google-sub-1', isActive: false, password: null })

		const res = await signInWithGoogle(createTestApp({ googleOidc: createFakeGoogle() }))

		expectLoginError(res, 'AUTH_USER_BLOCKED')
		expect(await getTestPrisma().session.count()).toBe(0)
	})

	it('rejects a callback without the OAuth cookie or with another state', async () => {
		const app = createTestApp({ googleOidc: createFakeGoogle() })

		expectLoginError(await request(app).get('/api/auth/oauth/google/callback?code=google-code&state=x'), 'AUTH_OAUTH_FAILED')
		expectLoginError(await signInWithGoogle(app, { state: 'forged-state' }), 'AUTH_OAUTH_FAILED')
		expect(await getTestPrisma().user.count()).toBe(0)
	})

	it('does not let a Google-only user sign in with a password', async () => {
		const app = createTestApp({ googleOidc: createFakeGoogle() })
		await signInWithGoogle(app)

		const res = await request(app).post('/api/auth/login').set(CSRF_HEADERS).send({ email: 'jana.novakova@gmail.com', password: TEST_PASSWORD })

		expect(res.status).toBe(401)
		expect(errorResponseSchema.parse(res.body).error.code).toBe(ERROR_CODE.AUTH_INVALID_CREDENTIALS)
	})
})
