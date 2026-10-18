import { Router } from 'express'

import { type Config } from '../config/env'
import { createCreateProjectMemberController, createListProjectMembersController } from '../controllers/projectMembers.controller'
import { createGetProjectSettingsController, createUpdateProjectSettingsController } from '../controllers/projectSettings.controller'
import { createCreateProjectController, createLeaveProjectController, createListProjectsController } from '../controllers/projects.controller'
import { type PrismaClient } from '../lib/prisma'
import { createRequireAuth } from '../middleware/auth.middleware'
import { createRequireProjectAccess } from '../middleware/projectAccess.middleware'

export const createProjectsRouter = (prisma: PrismaClient, config: Config): Router => {
	const router = Router()
	const requireProjectAccess = createRequireProjectAccess(prisma)
	router.use(createRequireAuth(prisma, config))
	router.get('/', createListProjectsController(prisma))
	router.post('/', createCreateProjectController(prisma))
	router.delete('/:projectId/membership', requireProjectAccess, createLeaveProjectController(prisma))
	router.get('/:projectId/settings', requireProjectAccess, createGetProjectSettingsController(prisma))
	router.patch('/:projectId/settings', requireProjectAccess, createUpdateProjectSettingsController(prisma))
	router.get('/:projectId/members', requireProjectAccess, createListProjectMembersController(prisma))
	router.post('/:projectId/members', requireProjectAccess, createCreateProjectMemberController(prisma))
	return router
}
