import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { ERROR_CODE, ROLE, VALIDATION_CODE, errorResponseSchema, profileSchema } from '@locale/shared'

import { createTestApp } from './helpers/app'
import { CSRF_HEADERS, loginAs } from './helpers/auth'
import { getTestPrisma } from './helpers/db'
import { TEST_PASSWORD, createUser } from './helpers/users'

type App = ReturnType<typeof createTestApp>

const expectErrorCode = (res: request.Response, status: number, code: ERROR_CODE) => {
	expect(res.status).toBe(status)
	expect(errorResponseSchema.parse(res.body).error.code).toBe(code)
}

const loginWithUser = async (app: App, options: Parameters<typeof createUser>[0] = {}) => {
	const { user } = await createUser(options)
	const cookie = await loginAs(app, { email: user.email, password: TEST_PASSWORD })
	return { user, cookie }
}

const patchProfile = (app: App, cookie: string, body: unknown) =>
	request(app)
		.patch('/api/profile')
		.set('Cookie', cookie)
		.set(CSRF_HEADERS)
		.send(body as object)

describe('GET /api/profile', () => {
	it.each([ROLE.ADMIN, ROLE.USER])('returns the profile of the session user for %s', async (role) => {
		const app = createTestApp()
		const passwordChangedAt = new Date('2026-05-04T10:20:30.000Z')
		const { user } = await createUser({ role, firstName: 'Jana', lastName: 'Nováková' })
		await getTestPrisma().user.update({ where: { id: user.id }, data: { passwordChangedAt } })
		await createUser({ firstName: 'Iný', lastName: 'Používateľ' })
		const cookie = await loginAs(app, { email: user.email, password: TEST_PASSWORD })

		const res = await request(app).get('/api/profile').set('Cookie', cookie)

		expect(res.status).toBe(200)
		expect(res.body).toEqual({
			id: user.id,
			email: user.email,
			role,
			firstName: 'Jana',
			lastName: 'Nováková',
			preferences: { translationsView: 'EXTENDED', translationsLayout: 'COLUMNS' },
			passwordChangedAt: '2026-05-04T10:20:30.000Z',
		})
	})

	it('returns null names when they are not set', async () => {
		const app = createTestApp()
		const { cookie } = await loginWithUser(app)

		const res = await request(app).get('/api/profile').set('Cookie', cookie)

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({ firstName: null, lastName: null })
	})

	it('returns 401 AUTH_UNAUTHENTICATED without a session', async () => {
		expectErrorCode(await request(createTestApp()).get('/api/profile'), 401, ERROR_CODE.AUTH_UNAUTHENTICATED)
	})
})

describe('PATCH /api/profile', () => {
	it('stores trimmed names and returns the new profile', async () => {
		const app = createTestApp()
		const { user, cookie } = await loginWithUser(app, { firstName: 'Stará', lastName: 'Hodnota' })

		const res = await patchProfile(app, cookie, { firstName: '  Jana ', lastName: ' Nováková  ' })

		expect(res.status).toBe(200)
		expect(res.body).toEqual({
			id: user.id,
			email: user.email,
			role: ROLE.USER,
			firstName: 'Jana',
			lastName: 'Nováková',
			preferences: { translationsView: 'EXTENDED', translationsLayout: 'COLUMNS' },
			passwordChangedAt: user.passwordChangedAt.toISOString(),
		})
		const stored = await getTestPrisma().user.findUniqueOrThrow({ where: { id: user.id } })
		expect(stored).toMatchObject({ firstName: 'Jana', lastName: 'Nováková' })
	})

	it('makes GET /api/auth/me return the new name', async () => {
		const app = createTestApp()
		const { cookie } = await loginWithUser(app)
		await patchProfile(app, cookie, { firstName: 'Jana', lastName: 'Nováková' }).expect(200)

		const res = await request(app).get('/api/auth/me').set('Cookie', cookie)

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({ firstName: 'Jana', lastName: 'Nováková' })
	})

	it('ignores the email in the body', async () => {
		const app = createTestApp()
		const { user, cookie } = await loginWithUser(app)

		const res = await patchProfile(app, cookie, { firstName: 'Jana', lastName: 'Nováková', email: 'iny@firma.sk' })

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({ email: user.email, role: ROLE.USER })
		const stored = await getTestPrisma().user.findUniqueOrThrow({ where: { id: user.id } })
		expect(stored).toMatchObject({ email: user.email, role: ROLE.USER })
	})

	it('lets an admin change their role when another admin stays and GET /api/auth/me reflects it', async () => {
		const app = createTestApp()
		await createUser({ role: ROLE.ADMIN })
		const { user, cookie } = await loginWithUser(app, { role: ROLE.ADMIN })

		const res = await patchProfile(app, cookie, { firstName: 'Jana', lastName: 'Nováková', role: ROLE.USER })

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({ role: ROLE.USER })
		const stored = await getTestPrisma().user.findUniqueOrThrow({ where: { id: user.id } })
		expect(stored.role).toBe(ROLE.USER)
		const me = await request(app).get('/api/auth/me').set('Cookie', cookie)
		expect(me.body).toMatchObject({ role: ROLE.USER })
	})

	it('returns 409 LAST_ADMIN when the only admin gives up the role', async () => {
		const app = createTestApp()
		const { user, cookie } = await loginWithUser(app, { role: ROLE.ADMIN })

		const res = await patchProfile(app, cookie, { firstName: 'Jana', lastName: 'Nováková', role: ROLE.USER })

		expectErrorCode(res, 409, ERROR_CODE.LAST_ADMIN)
		const stored = await getTestPrisma().user.findUniqueOrThrow({ where: { id: user.id } })
		expect(stored).toMatchObject({ role: ROLE.ADMIN, firstName: null })
	})

	it('returns 403 FORBIDDEN when an editor sends another role and accepts their own role', async () => {
		const app = createTestApp()
		const { user, cookie } = await loginWithUser(app)

		const forbidden = await patchProfile(app, cookie, { firstName: 'Jana', lastName: 'Nováková', role: ROLE.ADMIN })

		expectErrorCode(forbidden, 403, ERROR_CODE.FORBIDDEN)
		const stored = await getTestPrisma().user.findUniqueOrThrow({ where: { id: user.id } })
		expect(stored).toMatchObject({ role: ROLE.USER, firstName: null })

		const same = await patchProfile(app, cookie, { firstName: 'Jana', lastName: 'Nováková', role: ROLE.USER })
		expect(same.status).toBe(200)
		expect(same.body).toMatchObject({ role: ROLE.USER, firstName: 'Jana' })
	})

	it('changes only the session user', async () => {
		const app = createTestApp()
		const { cookie } = await loginWithUser(app)
		const { user: other } = await createUser({ firstName: 'Iný', lastName: 'Používateľ' })

		await patchProfile(app, cookie, { firstName: 'Jana', lastName: 'Nováková' }).expect(200)

		const stored = await getTestPrisma().user.findUniqueOrThrow({ where: { id: other.id } })
		expect(stored).toMatchObject({ firstName: 'Iný', lastName: 'Používateľ' })
	})

	it.each([
		{
			name: 'blank names',
			body: { firstName: '   ', lastName: '' },
			details: [
				{ path: 'firstName', code: VALIDATION_CODE.REQUIRED },
				{ path: 'lastName', code: VALIDATION_CODE.REQUIRED },
			],
		},
		{
			name: 'too long name',
			body: { firstName: 'a'.repeat(101), lastName: 'Nováková' },
			details: [{ path: 'firstName', code: VALIDATION_CODE.TOO_LONG, params: { max: 100 } }],
		},
		{
			name: 'unknown role',
			body: { firstName: 'Jana', lastName: 'Nováková', role: 'OWNER' },
			details: [{ path: 'role', code: VALIDATION_CODE.INVALID }],
		},
		{
			name: 'missing fields',
			body: {},
			details: [
				{ path: 'firstName', code: VALIDATION_CODE.REQUIRED },
				{ path: 'lastName', code: VALIDATION_CODE.REQUIRED },
			],
		},
	])('returns 400 VALIDATION_ERROR with details for $name', async ({ body, details }) => {
		const app = createTestApp()
		const { user, cookie } = await loginWithUser(app, { firstName: 'Stará', lastName: 'Hodnota' })

		const res = await patchProfile(app, cookie, body)

		expectErrorCode(res, 400, ERROR_CODE.VALIDATION_ERROR)
		expect(errorResponseSchema.parse(res.body).error.details).toEqual(details)
		const stored = await getTestPrisma().user.findUniqueOrThrow({ where: { id: user.id } })
		expect(stored).toMatchObject({ firstName: 'Stará', lastName: 'Hodnota' })
	})

	it('returns 401 AUTH_UNAUTHENTICATED without a session', async () => {
		const res = await request(createTestApp()).patch('/api/profile').set(CSRF_HEADERS).send({ firstName: 'Jana', lastName: 'Nováková' })

		expectErrorCode(res, 401, ERROR_CODE.AUTH_UNAUTHENTICATED)
	})

	it('returns 403 CSRF_REJECTED without X-Requested-With', async () => {
		const app = createTestApp()
		const { user, cookie } = await loginWithUser(app, { firstName: 'Stará', lastName: 'Hodnota' })

		const res = await request(app).patch('/api/profile').set('Cookie', cookie).send({ firstName: 'Jana', lastName: 'Nováková' })

		expectErrorCode(res, 403, ERROR_CODE.CSRF_REJECTED)
		const stored = await getTestPrisma().user.findUniqueOrThrow({ where: { id: user.id } })
		expect(stored).toMatchObject({ firstName: 'Stará', lastName: 'Hodnota' })
	})
})

describe('PATCH /api/profile/preferences', () => {
	const patchPreferences = (app: App, cookie: string, body: unknown) =>
		request(app)
			.patch('/api/profile/preferences')
			.set('Cookie', cookie)
			.set(CSRF_HEADERS)
			.send(body as object)

	it('stores the translations view, returns the profile and GET /api/auth/me reflects it', async () => {
		const app = createTestApp()
		const { user, cookie } = await loginWithUser(app)

		const res = await patchPreferences(app, cookie, { translationsView: 'COMPACT' })

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({ id: user.id, preferences: { translationsView: 'COMPACT' } })
		expect((await getTestPrisma().user.findUniqueOrThrow({ where: { id: user.id } })).translationsView).toBe('COMPACT')
		const me = await request(app).get('/api/auth/me').set('Cookie', cookie)
		expect(me.body).toMatchObject({ preferences: { translationsView: 'COMPACT' } })
	})

	it('stores the layout alone and keeps the view', async () => {
		const app = createTestApp()
		const { user, cookie } = await loginWithUser(app)

		const res = await patchPreferences(app, cookie, { translationsLayout: 'STACKED' })

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({ preferences: { translationsView: 'EXTENDED', translationsLayout: 'STACKED' } })
		expect((await getTestPrisma().user.findUniqueOrThrow({ where: { id: user.id } })).translationsLayout).toBe('STACKED')
	})

	it('returns 400 VALIDATION_ERROR for an unknown view or an empty body', async () => {
		const app = createTestApp()
		const { cookie } = await loginWithUser(app)

		const unknown = await patchPreferences(app, cookie, { translationsView: 'WIDE' })
		expectErrorCode(unknown, 400, ERROR_CODE.VALIDATION_ERROR)
		expect(errorResponseSchema.parse(unknown.body).error.details).toEqual([{ path: 'translationsView', code: VALIDATION_CODE.INVALID }])
		const missing = await patchPreferences(app, cookie, {})
		expectErrorCode(missing, 400, ERROR_CODE.VALIDATION_ERROR)
		expect(errorResponseSchema.parse(missing.body).error.details).toMatchObject([{ path: '' }])
	})

	it('returns 401 AUTH_UNAUTHENTICATED without a session and 403 CSRF_REJECTED without the header', async () => {
		const app = createTestApp()
		const { cookie } = await loginWithUser(app)

		expectErrorCode(
			await request(app).patch('/api/profile/preferences').set(CSRF_HEADERS).send({ translationsView: 'COMPACT' }),
			401,
			ERROR_CODE.AUTH_UNAUTHENTICATED,
		)
		expectErrorCode(
			await request(app).patch('/api/profile/preferences').set('Cookie', cookie).send({ translationsView: 'COMPACT' }),
			403,
			ERROR_CODE.CSRF_REJECTED,
		)
	})
})

describe('PUT /api/profile/password', () => {
	const NEW_PASSWORD = 'NewPassword456'

	const putPassword = (app: App, cookie: string, body: unknown) =>
		request(app)
			.put('/api/profile/password')
			.set('Cookie', cookie)
			.set(CSRF_HEADERS)
			.send(body as object)

	it('changes the password, sets passwordChangedAt and keeps the session', async () => {
		const app = createTestApp()
		const { user, cookie } = await loginWithUser(app)
		const before = (await getTestPrisma().user.findUniqueOrThrow({ where: { id: user.id } })).passwordChangedAt

		const res = await putPassword(app, cookie, { currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD })

		expect(res.status).toBe(200)
		const body = profileSchema.parse(res.body)
		expect(body).toMatchObject({ id: user.id, email: user.email })
		expect(res.body).not.toHaveProperty('passwordHash')
		expect(new Date(body.passwordChangedAt).getTime()).toBeGreaterThan(before.getTime())
		expect((await request(app).get('/api/profile').set('Cookie', cookie)).status).toBe(200)
		expectErrorCode(
			await request(app).post('/api/auth/login').set(CSRF_HEADERS).send({ email: user.email, password: TEST_PASSWORD }),
			401,
			ERROR_CODE.AUTH_INVALID_CREDENTIALS,
		)
		expect((await request(app).post('/api/auth/login').set(CSRF_HEADERS).send({ email: user.email, password: NEW_PASSWORD })).status).toBe(200)
	})

	it('returns 400 PASSWORD_INCORRECT for a wrong current password and changes nothing', async () => {
		const app = createTestApp()
		const { user, cookie } = await loginWithUser(app)
		const { passwordHash, passwordChangedAt } = await getTestPrisma().user.findUniqueOrThrow({ where: { id: user.id } })

		const res = await putPassword(app, cookie, { currentPassword: 'WrongPassword1', newPassword: NEW_PASSWORD })

		expectErrorCode(res, 400, ERROR_CODE.PASSWORD_INCORRECT)
		expect(await getTestPrisma().user.findUniqueOrThrow({ where: { id: user.id } })).toMatchObject({ passwordHash, passwordChangedAt })
	})

	it('returns 400 VALIDATION_ERROR with details for a short or missing password', async () => {
		const app = createTestApp()
		const { cookie } = await loginWithUser(app)

		const short = await putPassword(app, cookie, { currentPassword: TEST_PASSWORD, newPassword: 'short' })
		expectErrorCode(short, 400, ERROR_CODE.VALIDATION_ERROR)
		expect(errorResponseSchema.parse(short.body).error.details).toEqual([{ path: 'newPassword', code: VALIDATION_CODE.TOO_SHORT, params: { min: 8 } }])
		const missing = await putPassword(app, cookie, { newPassword: NEW_PASSWORD })
		expectErrorCode(missing, 400, ERROR_CODE.VALIDATION_ERROR)
		expect(errorResponseSchema.parse(missing.body).error.details).toEqual([{ path: 'currentPassword', code: VALIDATION_CODE.REQUIRED }])
	})

	it('returns 401 AUTH_UNAUTHENTICATED without a session and 403 CSRF_REJECTED without the header', async () => {
		const app = createTestApp()
		const { cookie } = await loginWithUser(app)
		const body = { currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD }

		expectErrorCode(await request(app).put('/api/profile/password').set(CSRF_HEADERS).send(body), 401, ERROR_CODE.AUTH_UNAUTHENTICATED)
		expectErrorCode(await request(app).put('/api/profile/password').set('Cookie', cookie).send(body), 403, ERROR_CODE.CSRF_REJECTED)
	})
})
