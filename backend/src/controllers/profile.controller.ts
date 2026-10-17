import { type RequestHandler } from 'express'

import { updateProfileRequestSchema, type Profile } from '@locale/shared'

import { type PrismaClient } from '../lib/prisma'
import { getAuth } from '../middleware/auth.middleware'
import { getProfile, updateProfile } from '../services/profile.service'

export const createGetProfileController =
	(prisma: PrismaClient): RequestHandler =>
	async (req, res) => {
		const body: Profile = await getProfile(prisma, getAuth(req).user.id)
		res.status(200).json(body)
	}

export const createUpdateProfileController =
	(prisma: PrismaClient): RequestHandler =>
	async (req, res) => {
		const input = updateProfileRequestSchema.parse(req.body)
		const body: Profile = await updateProfile(prisma, getAuth(req).user.id, input)
		res.status(200).json(body)
	}
