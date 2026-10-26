import { Router } from 'express'

import { type Config } from '../config/env'
import {
	createGoogleCallbackController,
	createGoogleStartController,
	createLoginController,
	createLogoutController,
	createProvidersController,
	meController,
} from '../controllers/auth.controller'
import { type GoogleOidc } from '../lib/googleOidc'
import { type PrismaClient } from '../lib/prisma'
import { createRequireAuth } from '../middleware/auth.middleware'
import { createLoginRateLimiter } from '../middleware/rateLimit.middleware'

/** Without `googleOidc` the Google endpoints are not mounted (404). */
export const createAuthRouter = (prisma: PrismaClient, config: Config, googleOidc?: GoogleOidc): Router => {
	const router = Router()
	router.post('/login', createLoginRateLimiter(config), createLoginController(prisma, config))
	router.post('/logout', createLogoutController(prisma, config))
	router.get('/me', createRequireAuth(prisma, config), meController)
	router.get('/providers', createProvidersController(googleOidc))
	if (googleOidc) {
		router.get('/oauth/google', createGoogleStartController(googleOidc, config))
		router.get('/oauth/google/callback', createGoogleCallbackController(prisma, googleOidc, config))
	}
	return router
}
