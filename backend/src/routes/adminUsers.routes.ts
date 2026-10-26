import { Router } from 'express'

import {
	createCreateUserController,
	createDeleteUserController,
	createGetUserController,
	createListUsersController,
	createSetUserPasswordController,
	createUpdateUserController,
} from '../controllers/adminUsers.controller'
import { type PrismaClient } from '../lib/prisma'

export const createAdminUsersRouter = (prisma: PrismaClient): Router => {
	const router = Router()
	router.get('/', createListUsersController(prisma))
	router.get('/:id', createGetUserController(prisma))
	router.post('/', createCreateUserController(prisma))
	router.patch('/:id', createUpdateUserController(prisma))
	router.put('/:id/password', createSetUserPasswordController(prisma))
	router.delete('/:id', createDeleteUserController(prisma))
	return router
}
