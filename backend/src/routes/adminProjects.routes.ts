import { Router } from 'express'

import { createDeleteProjectController, createListAllProjectsController } from '../controllers/adminProjects.controller'
import { type PrismaClient } from '../lib/prisma'

export const createAdminProjectsRouter = (prisma: PrismaClient): Router => {
	const router = Router()
	router.get('/', createListAllProjectsController(prisma))
	router.delete('/:projectId', createDeleteProjectController(prisma))
	return router
}
