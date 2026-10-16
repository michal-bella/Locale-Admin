import { Writable } from 'node:stream'

import { pino } from 'pino'
import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { createApp } from '../src/app'

import { TEST_CONFIG } from './helpers/app'
import { getTestPrisma } from './helpers/db'

const createCapturedApp = () => {
	const lines: string[] = []
	const stream = new Writable({
		write(chunk: Buffer, _encoding, callback) {
			lines.push(chunk.toString())
			callback()
		},
	})
	const app = createApp(TEST_CONFIG, { prisma: getTestPrisma(), logger: pino({ level: 'info' }, stream) })
	return { app, lines }
}

describe('request logging', () => {
	it('redacts the cookie and authorization headers', async () => {
		const { app, lines } = createCapturedApp()

		await request(app).get('/api/xyz').set('Cookie', 'session=super-secret-cookie').set('Authorization', 'Bearer super-secret-token')

		const output = lines.join('')
		expect(output).toContain('/api/xyz')
		expect(output).not.toContain('super-secret-cookie')
		expect(output).not.toContain('super-secret-token')
	})

	it('does not log GET /api/health', async () => {
		const { app, lines } = createCapturedApp()

		const res = await request(app).get('/api/health')

		expect(res.status).toBe(200)
		expect(lines.join('')).not.toContain('/api/health')
	})
})
