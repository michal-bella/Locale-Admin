import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { ERROR_CODE, ROLE, VALIDATION_CODE, errorResponseSchema } from '@locale/shared'

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
	it.each([ROLE.ADMIN, ROLE.EDITOR])('returns the profile of the session user for %s', async (role) => {
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
			role: ROLE.EDITOR,
			firstName: 'Jana',
			lastName: 'Nováková',
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

	it('ignores email and role in the body', async () => {
		const app = createTestApp()
		const { user, cookie } = await loginWithUser(app)

		const res = await patchProfile(app, cookie, { firstName: 'Jana', lastName: 'Nováková', email: 'iny@firma.sk', role: ROLE.ADMIN })

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({ email: user.email, role: ROLE.EDITOR })
		const stored = await getTestPrisma().user.findUniqueOrThrow({ where: { id: user.id } })
		expect(stored).toMatchObject({ email: user.email, role: ROLE.EDITOR })
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
