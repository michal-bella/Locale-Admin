import { Router } from 'express'

import { type Config } from '../config/env'
import { createListLanguagesController } from '../controllers/adminLanguages.controller'
import { type PrismaClient } from '../lib/prisma'
import { createRequireAuth } from '../middleware/auth.middleware'

/** Read-only list for every signed-in user: project settings show the global base language to members too. Changes stay under /api/admin. */
export const createLanguagesRouter = (prisma: PrismaClient, config: Config): Router => {
	const router = Router()
	router.use(createRequireAuth(prisma, config))
	router.get('/', createListLanguagesController(prisma))
	return router
}
