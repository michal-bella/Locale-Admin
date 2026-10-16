import request from 'supertest'
import { afterAll, describe, expect, it } from 'vitest'

import { ERROR_CODE, HEALTH_STATUS, errorResponseSchema, healthResponseSchema } from '@locale/shared'

import { createPrismaClient } from '../src/lib/prisma'

import { createTestApp } from './helpers/app'

describe('GET /api/health', () => {
	it('returns 200 with database status ok', async () => {
		const res = await request(createTestApp()).get('/api/health')

		expect(res.status).toBe(200)
		const body = healthResponseSchema.parse(res.body)
		expect(body).toMatchObject({ status: HEALTH_STATUS.OK, version: '0.0.0-test', db: { status: HEALTH_STATUS.OK } })
		expect(body.db.latencyMs).toBeGreaterThanOrEqual(0)
	})

	describe('when the database is unreachable', () => {
		const unreachablePrisma = createPrismaClient('postgresql://locale:locale@127.0.0.1:1/locale_test')
		afterAll(() => unreachablePrisma.$disconnect())

		it('returns 503 with status error', async () => {
			const res = await request(createTestApp({ prisma: unreachablePrisma })).get('/api/health')

			expect(res.status).toBe(503)
			expect(healthResponseSchema.parse(res.body)).toEqual({
				status: HEALTH_STATUS.ERROR,
				version: '0.0.0-test',
				db: { status: HEALTH_STATUS.ERROR, latencyMs: null },
			})
		})
	})
})

describe('unknown API route', () => {
	it('returns 404 NOT_FOUND in the error contract', async () => {
		const res = await request(createTestApp()).get('/api/xyz')

		expect(res.status).toBe(404)
		expect(errorResponseSchema.parse(res.body).error.code).toBe(ERROR_CODE.NOT_FOUND)
	})
})
