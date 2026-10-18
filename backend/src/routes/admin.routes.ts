import { Router } from 'express'

import { ROLE } from '@locale/shared'

import { type Config } from '../config/env'
import { type PrismaClient } from '../lib/prisma'
import { createRequireAuth, requireRole } from '../middleware/auth.middleware'

import { createAdminProjectsRouter } from './adminProjects.routes'
import { createAdminUsersRouter } from './adminUsers.routes'

export const createAdminRouter = (prisma: PrismaClient, config: Config): Router => {
	const router = Router()
	router.use(createRequireAuth(prisma, config), requireRole(ROLE.ADMIN))
	router.use('/projects', createAdminProjectsRouter(prisma))
	router.use('/users', createAdminUsersRouter(prisma))
	return router
}
