import { createHash, randomBytes } from 'node:crypto'

import { type AuthUser } from '@locale/shared'

import { type Config } from '../config/env'
import { toAuthUser } from '../lib/authUser'
import { type PrismaClient } from '../lib/prisma'

/** Sliding TTL is written to the DB (and re-sent in Set-Cookie) at most this often per session. */
export const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000

const DAY_MS = 24 * 60 * 60 * 1000

export type SessionConfig = Pick<Config, 'sessionTtlDays' | 'sessionMaxAgeDays'>

export type ActiveSession = {
	sessionId: string
	user: AuthUser
	expiresAt: Date
	/** True when `expiresAt` moved and the cookie has to be sent again. */
	touched: boolean
}

export const generateSessionToken = (): string => randomBytes(32).toString('base64url')

export const hashSessionToken = (token: string): string => createHash('sha256').update(token).digest('hex')

const getAbsoluteExpiry = (createdAt: Date, config: SessionConfig): Date => new Date(createdAt.getTime() + config.sessionMaxAgeDays * DAY_MS)

export const computeExpiresAt = (now: Date, createdAt: Date, config: SessionConfig): Date =>
	new Date(Math.min(now.getTime() + config.sessionTtlDays * DAY_MS, getAbsoluteExpiry(createdAt, config).getTime()))

/** Builds the Prisma create input for a new session; the token goes only to the cookie. */
export const buildNewSession = (userId: string, config: SessionConfig, now: Date) => {
	const token = generateSessionToken()
	const data = { userId, tokenHash: hashSessionToken(token), createdAt: now, lastUsedAt: now, expiresAt: computeExpiresAt(now, now, config) }
	return { token, data }
}

/** Returns the session for a cookie token, or null after deleting it when it is expired or its user is inactive. */
export const resolveSession = async (prisma: PrismaClient, token: string, config: SessionConfig, now = new Date()): Promise<ActiveSession | null> => {
	const session = await prisma.session.findUnique({ where: { tokenHash: hashSessionToken(token) }, include: { user: true } })
	if (!session) {
		return null
	}

	const isExpired = session.expiresAt <= now || getAbsoluteExpiry(session.createdAt, config) <= now
	if (isExpired || !session.user.isActive) {
		await prisma.session.deleteMany({ where: { id: session.id } })
		return null
	}

	if (now.getTime() - session.lastUsedAt.getTime() < SESSION_TOUCH_INTERVAL_MS) {
		return { sessionId: session.id, user: toAuthUser(session.user), expiresAt: session.expiresAt, touched: false }
	}

	const expiresAt = computeExpiresAt(now, session.createdAt, config)
	// updateMany: a concurrent logout may have deleted the row already.
	await prisma.session.updateMany({ where: { id: session.id }, data: { lastUsedAt: now, expiresAt } })
	return { sessionId: session.id, user: toAuthUser(session.user), expiresAt, touched: true }
}

/** Signs a user out everywhere, or everywhere else when `exceptSessionId` is the caller's own session. */
export const deleteUserSessions = async (prisma: PrismaClient, userId: string, exceptSessionId?: string): Promise<void> => {
	await prisma.session.deleteMany({ where: { userId, ...(exceptSessionId && { id: { not: exceptSessionId } }) } })
}

export const deleteSessionByToken = async (prisma: PrismaClient, token: string): Promise<void> => {
	await prisma.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } })
}
