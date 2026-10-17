import { Router } from 'express'

import { ROLE } from '@locale/shared'

import { type Config } from '../config/env'
import { type PrismaClient } from '../lib/prisma'
import { createRequireAuth, requireRole } from '../middleware/auth.middleware'

import { createAdminLanguagesRouter } from './adminLanguages.routes'
import { createAdminProjectRouter } from './adminProject.routes'
import { createAdminUsersRouter } from './adminUsers.routes'

export const createAdminRouter = (prisma: PrismaClient, config: Config): Router => {
	const router = Router()
	router.use(createRequireAuth(prisma, config), requireRole(ROLE.ADMIN))
	router.use('/users', createAdminUsersRouter(prisma))
	router.use('/languages', createAdminLanguagesRouter(prisma))
	router.use('/project', createAdminProjectRouter(prisma))
	return router
}
