import { Router } from 'express'

import { createCreateLanguageController, createDeleteLanguageController, createUpdateLanguageController } from '../controllers/adminLanguages.controller'
import { type PrismaClient } from '../lib/prisma'

export const createAdminLanguagesRouter = (prisma: PrismaClient): Router => {
	const router = Router()
	router.post('/', createCreateLanguageController(prisma))
	router.patch('/:id', createUpdateLanguageController(prisma))
	router.delete('/:id', createDeleteLanguageController(prisma))
	return router
}
