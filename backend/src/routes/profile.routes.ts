import { Router } from 'express'

import { type Config } from '../config/env'
import { createGetProfileController, createUpdateProfileController } from '../controllers/profile.controller'
import { type PrismaClient } from '../lib/prisma'
import { createRequireAuth } from '../middleware/auth.middleware'

export const createProfileRouter = (prisma: PrismaClient, config: Config): Router => {
	const router = Router()
	router.use(createRequireAuth(prisma, config))
	router.get('/', createGetProfileController(prisma))
	router.patch('/', createUpdateProfileController(prisma))
	return router
}
