import { type Request, type RequestHandler } from 'express'

import { ERROR_CODE, type AuthUser, type ROLE } from '@locale/shared'

import { type Config } from '../config/env'
import { AppError } from '../lib/errors'
import { type PrismaClient } from '../lib/prisma'
import { clearSessionCookie, readSessionToken, setSessionCookie } from '../lib/sessionCookie'
import { resolveSession } from '../services/session.service'

export type AuthContext = {
	user: AuthUser
	sessionId: string
}

declare global {
	// Express request augmentation only works with a namespace and an interface.
	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace Express {
		// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
		interface Request {
			/** Set by `requireAuth`. */
			auth?: AuthContext
		}
	}
}

const unauthenticated = () => new AppError(401, ERROR_CODE.AUTH_UNAUTHENTICATED, 'Authentication required')

/** Returns the auth context of a request that went through `requireAuth`. */
export const getAuth = (req: Request): AuthContext => {
	if (!req.auth) {
		throw unauthenticated()
	}
	return req.auth
}

export const createRequireAuth =
	(prisma: PrismaClient, config: Pick<Config, 'cookieSecure' | 'sessionTtlDays' | 'sessionMaxAgeDays'>): RequestHandler =>
	async (req, res, next) => {
		const token = readSessionToken(req)
		if (!token) {
			next(unauthenticated())
			return
		}

		const session = await resolveSession(prisma, token, config)
		if (!session) {
			clearSessionCookie(res, config)
			next(unauthenticated())
			return
		}

		if (session.touched) {
			setSessionCookie(res, config, token, session.expiresAt)
		}
		req.auth = { user: session.user, sessionId: session.sessionId }
		next()
	}

export const requireRole =
	(...roles: ROLE[]): RequestHandler =>
	(req, _res, next) => {
		if (!roles.includes(getAuth(req).user.role)) {
			next(new AppError(403, ERROR_CODE.FORBIDDEN, 'Insufficient role'))
			return
		}
		next()
	}
