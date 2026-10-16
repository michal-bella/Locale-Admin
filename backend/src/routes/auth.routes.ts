import { Router } from 'express'

import { type Config } from '../config/env'
import { createLoginController, createLogoutController, meController } from '../controllers/auth.controller'
import { type PrismaClient } from '../lib/prisma'
import { createRequireAuth } from '../middleware/auth.middleware'
import { createLoginRateLimiter } from '../middleware/rateLimit.middleware'

export const createAuthRouter = (prisma: PrismaClient, config: Config): Router => {
	const router = Router()
	router.post('/login', createLoginRateLimiter(config), createLoginController(prisma, config))
	router.post('/logout', createLogoutController(prisma, config))
	router.get('/me', createRequireAuth(prisma, config), meController)
	return router
}
