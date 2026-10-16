import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { ERROR_CODE, errorResponseSchema } from '@locale/shared'

import { SESSION_TOUCH_INTERVAL_MS } from '../src/services/session.service'

import { createTestApp } from './helpers/app'
import { findSessionByCookie, getSessionSetCookie, loginAs } from './helpers/auth'
import { getTestPrisma } from './helpers/db'
import { TEST_PASSWORD, createUser } from './helpers/users'

const MINUTE_MS = 60 * 1000
const DAY_MS = 24 * 60 * MINUTE_MS

const setUp = async () => {
	const app = createTestApp()
	const { user } = await createUser()
	const cookie = await loginAs(app, { email: user.email, password: TEST_PASSWORD })
	const session = await findSessionByCookie(cookie)
	if (!session) {
		throw new Error('session not created')
	}
	const update = (data: { createdAt?: Date; lastUsedAt?: Date; expiresAt?: Date }) => getTestPrisma().session.update({ where: { id: session.id }, data })
	return { app, user, cookie, session, update }
}

const getMe = (app: ReturnType<typeof createTestApp>, cookie: string) => request(app).get('/api/auth/me').set('Cookie', cookie)

const expectUnauthenticatedAndCleared = (res: request.Response) => {
	expect(res.status).toBe(401)
	expect(errorResponseSchema.parse(res.body).error.code).toBe(ERROR_CODE.AUTH_UNAUTHENTICATED)
	const cleared = getSessionSetCookie(res)
	expect(cleared?.value).toBe('')
	expect(new Date(String(cleared?.attributes.expires)).getTime()).toBeLessThan(Date.now())
}

describe('session expiry', () => {
	it('returns 401, deletes the row and clears the cookie after the TTL', async () => {
		const { app, cookie, update } = await setUp()
		await update({ expiresAt: new Date(Date.now() - 1000) })

		expectUnauthenticatedAndCleared(await getMe(app, cookie))
		expect(await findSessionByCookie(cookie)).toBeNull()
	})

	it('returns 401 after the absolute limit even when expiresAt is still in the future', async () => {
		const { app, cookie, update } = await setUp()
		await update({ createdAt: new Date(Date.now() - 31 * DAY_MS), expiresAt: new Date(Date.now() + DAY_MS) })

		expectUnauthenticatedAndCleared(await getMe(app, cookie))
		expect(await findSessionByCookie(cookie)).toBeNull()
	})

	it('returns 401 and deletes the session of a deactivated user', async () => {
		const { app, user, cookie } = await setUp()
		await getTestPrisma().user.update({ where: { id: user.id }, data: { isActive: false } })

		expectUnauthenticatedAndCleared(await getMe(app, cookie))
		expect(await findSessionByCookie(cookie)).toBeNull()
	})
})

describe('sliding session', () => {
	it('moves expiresAt and re-sends the cookie when lastUsedAt is older than the touch interval', async () => {
		const { app, cookie, update } = await setUp()
		const oldExpiresAt = new Date(Date.now() + DAY_MS)
		await update({ lastUsedAt: new Date(Date.now() - SESSION_TOUCH_INTERVAL_MS - MINUTE_MS), expiresAt: oldExpiresAt })

		const before = Date.now()
		const res = await getMe(app, cookie)

		expect(res.status).toBe(200)
		const refreshed = getSessionSetCookie(res)
		expect(`locale_session=${refreshed?.value}`).toBe(cookie)
		expect(refreshed?.attributes).toMatchObject({ httponly: true, samesite: 'Lax', path: '/' })
		const maxAgeS = Number(refreshed?.attributes['max-age'])
		expect(maxAgeS).toBeGreaterThanOrEqual(7 * 24 * 60 * 60 - 2)
		expect(maxAgeS).toBeLessThanOrEqual(7 * 24 * 60 * 60)

		const session = await findSessionByCookie(cookie)
		expect(session?.expiresAt.getTime()).toBeGreaterThan(oldExpiresAt.getTime())
		expect(Math.abs((session?.expiresAt.getTime() ?? 0) - (before + 7 * DAY_MS))).toBeLessThan(5000)
		expect(Math.abs((session?.lastUsedAt.getTime() ?? 0) - before)).toBeLessThan(5000)
	})

	it('caps the new expiry at the absolute limit', async () => {
		const { app, cookie, update } = await setUp()
		const createdAt = new Date(Date.now() - 29.5 * DAY_MS)
		await update({ createdAt, lastUsedAt: new Date(Date.now() - SESSION_TOUCH_INTERVAL_MS - MINUTE_MS), expiresAt: new Date(Date.now() + MINUTE_MS) })

		const res = await getMe(app, cookie)

		expect(res.status).toBe(200)
		const maxAgeS = Number(getSessionSetCookie(res)?.attributes['max-age'])
		expect(Math.abs(maxAgeS - 0.5 * 24 * 60 * 60)).toBeLessThan(5)
		const session = await findSessionByCookie(cookie)
		expect(session?.expiresAt.getTime()).toBe(createdAt.getTime() + 30 * DAY_MS)
	})

	it('does not write to the DB or send a cookie within the touch interval', async () => {
		const { app, cookie, update } = await setUp()
		const lastUsedAt = new Date(Date.now() - SESSION_TOUCH_INTERVAL_MS + MINUTE_MS)
		const expiresAt = new Date(Date.now() + DAY_MS)
		await update({ lastUsedAt, expiresAt })

		const res = await getMe(app, cookie)

		expect(res.status).toBe(200)
		expect(getSessionSetCookie(res)).toBeUndefined()
		const session = await findSessionByCookie(cookie)
		expect(session?.lastUsedAt.getTime()).toBe(lastUsedAt.getTime())
		expect(session?.expiresAt.getTime()).toBe(expiresAt.getTime())
	})
})
