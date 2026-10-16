import { type Express } from 'express'
import request, { type Response } from 'supertest'

import { SESSION_COOKIE_NAME } from '../../src/lib/sessionCookie'
import { hashSessionToken } from '../../src/services/session.service'

import { getTestPrisma } from './db'

/** Headers the FE axios instance sends with every mutation (CSRF check). */
export const CSRF_HEADERS = { 'X-Requested-With': 'XMLHttpRequest' } as const

export type ParsedCookie = {
	value: string
	attributes: Record<string, string | true>
}

/** Parses the `locale_session` Set-Cookie header of a response, or returns undefined when there is none. */
export const getSessionSetCookie = (res: Response): ParsedCookie | undefined => {
	const header = res.headers['set-cookie'] as string[] | string | undefined
	const raw = [header ?? []].flat().find((cookie) => cookie.startsWith(`${SESSION_COOKIE_NAME}=`))
	if (!raw) {
		return undefined
	}
	const [pair = '', ...parts] = raw.split(';').map((part) => part.trim())
	const attributes: Record<string, string | true> = {}
	for (const part of parts) {
		const [name = '', ...value] = part.split('=')
		attributes[name.toLowerCase()] = value.length > 0 ? value.join('=') : true
	}
	return { value: pair.slice(SESSION_COOKIE_NAME.length + 1), attributes }
}

export const toCookieHeader = (token: string): string => `${SESSION_COOKIE_NAME}=${token}`

/** Logs in through the API and returns the `Cookie` header value for following requests. */
export const loginAs = async (app: Express, { email, password }: { email: string; password: string }): Promise<string> => {
	const res = await request(app).post('/api/auth/login').set(CSRF_HEADERS).send({ email, password })
	const cookie = getSessionSetCookie(res)
	if (res.status !== 200 || !cookie) {
		throw new Error(`loginAs failed with status ${res.status}`)
	}
	return toCookieHeader(cookie.value)
}

export const findSessionByCookie = (cookieHeader: string) =>
	getTestPrisma().session.findUnique({ where: { tokenHash: hashSessionToken(cookieHeader.slice(SESSION_COOKIE_NAME.length + 1)) } })
