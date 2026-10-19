import { type RequestHandler } from 'express'
import { z } from 'zod'

import { createUserRequestSchema, ERROR_CODE, type AdminUser, type AdminUserDetail, type AdminUserListResponse } from '@locale/shared'

import { AppError } from '../lib/errors'
import { type PrismaClient } from '../lib/prisma'
import { getAuth } from '../middleware/auth.middleware'
import { createUser, deleteUser, getUser, listUsers } from '../services/adminUsers.service'

export const createListUsersController =
	(prisma: PrismaClient): RequestHandler =>
	async (_req, res) => {
		const body: AdminUserListResponse = { users: await listUsers(prisma) }
		res.status(200).json(body)
	}

export const createGetUserController =
	(prisma: PrismaClient): RequestHandler<{ id: string }> =>
	async (req, res) => {
		if (!z.uuid().safeParse(req.params.id).success) {
			throw new AppError(404, ERROR_CODE.NOT_FOUND, 'User not found')
		}
		const body: AdminUserDetail = await getUser(prisma, req.params.id)
		res.status(200).json(body)
	}

export const createCreateUserController =
	(prisma: PrismaClient): RequestHandler =>
	async (req, res) => {
		const input = createUserRequestSchema.parse(req.body)
		const body: AdminUser = await createUser(prisma, input)
		res.status(201).json(body)
	}

export const createDeleteUserController =
	(prisma: PrismaClient): RequestHandler<{ id: string }> =>
	async (req, res) => {
		if (!z.uuid().safeParse(req.params.id).success) {
			throw new AppError(404, ERROR_CODE.NOT_FOUND, 'User not found')
		}
		await deleteUser(prisma, req.params.id, getAuth(req).user.id)
		res.status(204).end()
	}
