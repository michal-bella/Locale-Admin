import { type RequestHandler } from 'express'

import { loginRequestSchema } from '@locale/shared'

import { type Config } from '../config/env'
import { type PrismaClient } from '../lib/prisma'
import { clearSessionCookie, readSessionToken, setSessionCookie } from '../lib/sessionCookie'
import { getAuth } from '../middleware/auth.middleware'
import { login } from '../services/auth.service'
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
