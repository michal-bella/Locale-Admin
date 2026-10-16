import { Router } from 'express'

import { createCreateUserController, createListUsersController } from '../controllers/adminUsers.controller'
import { type PrismaClient } from '../lib/prisma'

export const createAdminUsersRouter = (prisma: PrismaClient): Router => {
	const router = Router()
	router.get('/', createListUsersController(prisma))
	router.post('/', createCreateUserController(prisma))
	return router
}
