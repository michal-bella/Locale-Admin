import { type CookieOptions, type Request, type Response } from 'express'

import { type Config } from '../config/env'

export const SESSION_COOKIE_NAME = 'locale_session'

type CookieConfig = Pick<Config, 'cookieSecure'>

const baseCookieOptions = (config: CookieConfig): CookieOptions => ({ httpOnly: true, sameSite: 'lax', path: '/', secure: config.cookieSecure })

export const readSessionToken = (req: Request): string | undefined => {
	const token: unknown = (req.cookies as Record<string, unknown> | undefined)?.[SESSION_COOKIE_NAME]
	return typeof token === 'string' && token.length > 0 ? token : undefined
}

export const setSessionCookie = (res: Response, config: CookieConfig, token: string, expiresAt: Date): void => {
	res.cookie(SESSION_COOKIE_NAME, token, { ...baseCookieOptions(config), maxAge: Math.max(0, expiresAt.getTime() - Date.now()) })
}

export const clearSessionCookie = (res: Response, config: CookieConfig): void => {
	res.clearCookie(SESSION_COOKIE_NAME, baseCookieOptions(config))
}
