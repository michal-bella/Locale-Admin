import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { ERROR_CODE, errorResponseSchema } from '@locale/shared'

import { createTestApp } from './helpers/app'
import { CSRF_HEADERS, loginAs } from './helpers/auth'
import { TEST_PASSWORD, createUser } from './helpers/users'

const expectCsrfRejected = (res: request.Response) => {
	expect(res.status).toBe(403)
	expect(errorResponseSchema.parse(res.body).error.code).toBe(ERROR_CODE.CSRF_REJECTED)
}

describe('CSRF middleware', () => {
	it('rejects a JSON mutation without X-Requested-With', async () => {
		const { user } = await createUser()

		expectCsrfRejected(await request(createTestApp()).post('/api/auth/login').send({ email: user.email, password: TEST_PASSWORD }))
	})

	it('rejects a form-encoded mutation even with X-Requested-With', async () => {
		const { user } = await createUser()

		const res = await request(createTestApp()).post('/api/auth/login').set(CSRF_HEADERS).type('form').send({ email: user.email, password: TEST_PASSWORD })

		expectCsrfRejected(res)
	})

	it('rejects a mutation without a body', async () => {
		expectCsrfRejected(await request(createTestApp()).post('/api/auth/logout').set(CSRF_HEADERS))
	})

	it.each(['put', 'patch', 'delete'] as const)('rejects %s without the headers, also on unknown routes', async (method) => {
		expectCsrfRejected(await request(createTestApp())[method]('/api/xyz').send({}))
	})

	it('lets logout with {} and the headers through', async () => {
		const app = createTestApp()
		const { user } = await createUser()
		const cookie = await loginAs(app, { email: user.email, password: TEST_PASSWORD })

		const res = await request(app).post('/api/auth/logout').set(CSRF_HEADERS).set('Cookie', cookie).send({})

		expect(res.status).toBe(204)
	})

	it('does not check GET requests', async () => {
		expect((await request(createTestApp()).get('/api/health')).status).toBe(200)
	})
})
