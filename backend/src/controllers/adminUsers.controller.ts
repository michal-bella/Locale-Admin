import { type RequestHandler } from 'express'

import { createUserRequestSchema, type AdminUser, type AdminUserListResponse } from '@locale/shared'

import { type PrismaClient } from '../lib/prisma'
import { createUser, listUsers } from '../services/adminUsers.service'

export const createListUsersController =
	(prisma: PrismaClient): RequestHandler =>
	async (_req, res) => {
		const body: AdminUserListResponse = { users: await listUsers(prisma) }
		res.status(200).json(body)
	}

export const createCreateUserController =
	(prisma: PrismaClient): RequestHandler =>
	async (req, res) => {
		const input = createUserRequestSchema.parse(req.body)
		const body: AdminUser = await createUser(prisma, input)
		res.status(201).json(body)
	}
