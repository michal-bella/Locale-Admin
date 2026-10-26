import { type CookieOptions, type Request, type Response } from 'express'
import { z } from 'zod'

import { type Config } from '../config/env'

import { type OAuthChecks } from './googleOidc'

export const OAUTH_COOKIE_NAME = 'locale_oauth'

const OAUTH_COOKIE_MAX_AGE_MS = 10 * 60 * 1000

const oauthChecksSchema = z.object({ codeVerifier: z.string().min(1), state: z.string().min(1), nonce: z.string().min(1) })

// Lax: the browser sends it with the top-level GET back from Google; the path keeps it out of every other request.
const cookieOptions = (config: Pick<Config, 'cookieSecure'>): CookieOptions => ({
	httpOnly: true,
	sameSite: 'lax',
	path: '/api/auth/oauth',
	secure: config.cookieSecure,
})

export const setOAuthCookie = (res: Response, config: Pick<Config, 'cookieSecure'>, checks: OAuthChecks): void => {
	res.cookie(OAUTH_COOKIE_NAME, JSON.stringify(checks), { ...cookieOptions(config), maxAge: OAUTH_COOKIE_MAX_AGE_MS })
}

export const readOAuthCookie = (req: Request): OAuthChecks | undefined => {
	const raw: unknown = (req.cookies as Record<string, unknown> | undefined)?.[OAUTH_COOKIE_NAME]
	if (typeof raw !== 'string') {
		return undefined
	}
	try {
		const result = oauthChecksSchema.safeParse(JSON.parse(raw))
		return result.success ? result.data : undefined
	} catch {
		return undefined
	}
}

export const clearOAuthCookie = (res: Response, config: Pick<Config, 'cookieSecure'>): void => {
	res.clearCookie(OAUTH_COOKIE_NAME, cookieOptions(config))
}
