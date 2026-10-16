import { Writable } from 'node:stream'

import { pino } from 'pino'
import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { createApp } from '../src/app'

import { TEST_CONFIG } from './helpers/app'
import { CSRF_HEADERS, getSessionSetCookie } from './helpers/auth'
import { getTestPrisma } from './helpers/db'
import { TEST_PASSWORD, createUser } from './helpers/users'

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

	it('redacts the session token in the Set-Cookie and Cookie headers', async () => {
		const { app, lines } = createCapturedApp()
		const { user } = await createUser()

		const login = await request(app).post('/api/auth/login').set(CSRF_HEADERS).send({ email: user.email, password: TEST_PASSWORD })
		const token = getSessionSetCookie(login)?.value ?? ''
		await request(app).get('/api/auth/me').set('Cookie', `locale_session=${token}`)

		expect(token).not.toBe('')
		const output = lines.join('')
		expect(output).toContain('/api/auth/me')
		expect(output).not.toContain(token)
		expect(output).not.toContain(TEST_PASSWORD)
	})

	it('does not log GET /api/health', async () => {
		const { app, lines } = createCapturedApp()

		const res = await request(app).get('/api/health')

		expect(res.status).toBe(200)
		expect(lines.join('')).not.toContain('/api/health')
	})
})
