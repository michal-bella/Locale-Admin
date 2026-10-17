import { Router } from 'express'

import { createGetProjectSettingsController, createUpdateProjectSettingsController } from '../controllers/adminProject.controller'
import { type PrismaClient } from '../lib/prisma'

export const createAdminProjectRouter = (prisma: PrismaClient): Router => {
	const router = Router()
	router.get('/', createGetProjectSettingsController(prisma))
	router.patch('/', createUpdateProjectSettingsController(prisma))
	return router
}
