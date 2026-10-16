import cookieParser from 'cookie-parser'
import express from 'express'
import { pino } from 'pino'
import { pinoHttp } from 'pino-http'
import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { ERROR_CODE, ROLE, errorResponseSchema } from '@locale/shared'

import { ROLE as PRISMA_ROLE } from '../src/generated/prisma/enums'
import { createRequireAuth, getAuth, requireRole } from '../src/middleware/auth.middleware'
import { errorMiddleware } from '../src/middleware/error.middleware'

import { TEST_CONFIG, createTestApp } from './helpers/app'
import { loginAs } from './helpers/auth'
import { getTestPrisma } from './helpers/db'
import { TEST_PASSWORD, createUser } from './helpers/users'

// Isolated app tests requireRole on its own; the real /api/admin routes are covered in adminUsers.test.ts.
const createAdminOnlyApp = () => {
	const app = express()
	app.use(pinoHttp({ logger: pino({ level: 'silent' }) }))
	app.use(cookieParser())
	app.get('/admin-only', createRequireAuth(getTestPrisma(), TEST_CONFIG), requireRole(ROLE.ADMIN), (req, res) => {
		res.json({ role: getAuth(req).user.role })
	})
	app.use(errorMiddleware)
	return app
}

const cookieFor = async (role: PRISMA_ROLE) => {
	const { user } = await createUser({ role })
	return loginAs(createTestApp(), { email: user.email, password: TEST_PASSWORD })
}

describe('requireRole(ROLE.ADMIN)', () => {
	it('lets an ADMIN through', async () => {
		const res = await request(createAdminOnlyApp())
			.get('/admin-only')
			.set('Cookie', await cookieFor(PRISMA_ROLE.ADMIN))

		expect(res.status).toBe(200)
		expect(res.body).toEqual({ role: ROLE.ADMIN })
	})

	it('returns 403 FORBIDDEN for an EDITOR', async () => {
		const res = await request(createAdminOnlyApp())
			.get('/admin-only')
			.set('Cookie', await cookieFor(PRISMA_ROLE.EDITOR))

		expect(res.status).toBe(403)
		expect(errorResponseSchema.parse(res.body).error.code).toBe(ERROR_CODE.FORBIDDEN)
	})

	it('returns 401 AUTH_UNAUTHENTICATED without a session', async () => {
		const res = await request(createAdminOnlyApp()).get('/admin-only')

		expect(res.status).toBe(401)
		expect(errorResponseSchema.parse(res.body).error.code).toBe(ERROR_CODE.AUTH_UNAUTHENTICATED)
	})
})
