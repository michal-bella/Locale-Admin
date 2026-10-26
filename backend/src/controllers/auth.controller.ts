import { type RequestHandler } from 'express'

import { ERROR_CODE, loginRequestSchema, type AuthProvidersResponse } from '@locale/shared'

import { type Config } from '../config/env'
import { AppError } from '../lib/errors'
import { createOAuthChecks, type GoogleOidc } from '../lib/googleOidc'
import { clearOAuthCookie, readOAuthCookie, setOAuthCookie } from '../lib/oauthCookie'
import { type PrismaClient } from '../lib/prisma'
import { clearSessionCookie, readSessionToken, setSessionCookie } from '../lib/sessionCookie'
import { getAuth } from '../middleware/auth.middleware'
import { login } from '../services/auth.service'
import { signInWithGoogle } from '../services/googleAuth.service'
import { deleteSessionByToken } from '../services/session.service'

type AuthControllerConfig = Pick<Config, 'cookieSecure' | 'sessionTtlDays' | 'sessionMaxAgeDays'>

export const createLoginController =
	(prisma: PrismaClient, config: AuthControllerConfig): RequestHandler =>
	async (req, res) => {
		const input = loginRequestSchema.parse(req.body)
		const { user, token, expiresAt } = await login(prisma, input, config, readSessionToken(req))
		setSessionCookie(res, config, token, expiresAt)
		res.status(200).json(user)
	}

export const createLogoutController =
	(prisma: PrismaClient, config: AuthControllerConfig): RequestHandler =>
	async (req, res) => {
		const token = readSessionToken(req)
		if (token) {
			await deleteSessionByToken(prisma, token)
		}
		clearSessionCookie(res, config)
		res.status(204).end()
	}

export const meController: RequestHandler = (req, res) => {
	res.status(200).json(getAuth(req).user)
}

export const createProvidersController =
	(googleOidc: GoogleOidc | undefined): RequestHandler =>
	(_req, res) => {
		const body: AuthProvidersResponse = { google: googleOidc !== undefined }
		res.status(200).json(body)
	}

/** The Google endpoints are browser navigations, so errors redirect to the login page with the code instead of a JSON body. */
const loginErrorUrl = (code: ERROR_CODE) => `/login?error=${code}`

export const createGoogleStartController =
	(googleOidc: GoogleOidc, config: AuthControllerConfig): RequestHandler =>
	async (req, res) => {
		const checks = createOAuthChecks()
		let authorizationUrl: URL
		try {
			authorizationUrl = await googleOidc.createAuthorizationUrl(checks)
		} catch (err) {
			req.log.error({ err }, 'Google sign-in could not start')
			res.redirect(303, loginErrorUrl(ERROR_CODE.AUTH_OAUTH_FAILED))
			return
		}
		setOAuthCookie(res, config, checks)
		res.redirect(302, authorizationUrl.href)
	}

export const createGoogleCallbackController =
	(prisma: PrismaClient, googleOidc: GoogleOidc, config: AuthControllerConfig): RequestHandler =>
	async (req, res) => {
		const checks = readOAuthCookie(req)
		clearOAuthCookie(res, config)
		try {
			if (!checks) {
				throw new AppError(400, ERROR_CODE.AUTH_OAUTH_FAILED, 'Missing or invalid OAuth cookie')
			}
			const identity = await googleOidc.exchangeCode(new URL(req.originalUrl, 'http://callback').searchParams, checks)
			const { token, expiresAt } = await signInWithGoogle(prisma, identity, config, readSessionToken(req))
			setSessionCookie(res, config, token, expiresAt)
			res.redirect(303, '/')
		} catch (err) {
			if (err instanceof AppError) {
				req.log.warn({ err }, 'Google sign-in rejected')
				res.redirect(303, loginErrorUrl(err.code))
				return
			}
			req.log.error({ err }, 'Google sign-in failed')
			res.redirect(303, loginErrorUrl(ERROR_CODE.AUTH_OAUTH_FAILED))
		}
	}
