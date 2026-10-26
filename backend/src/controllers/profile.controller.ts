import { type RequestHandler } from 'express'

import { changePasswordRequestSchema, updatePreferencesRequestSchema, updateProfileRequestSchema, type Profile } from '@locale/shared'

import { type PrismaClient } from '../lib/prisma'
import { getAuth } from '../middleware/auth.middleware'
import { changePassword, getProfile, updatePreferences, updateProfile } from '../services/profile.service'

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
		const body: Profile = await updateProfile(prisma, getAuth(req).user, input)
		res.status(200).json(body)
	}

export const createUpdatePreferencesController =
	(prisma: PrismaClient): RequestHandler =>
	async (req, res) => {
		const input = updatePreferencesRequestSchema.parse(req.body)
		const body: Profile = await updatePreferences(prisma, getAuth(req).user.id, input)
		res.status(200).json(body)
	}

export const createChangePasswordController =
	(prisma: PrismaClient): RequestHandler =>
	async (req, res) => {
		const input = changePasswordRequestSchema.parse(req.body)
		const { user, sessionId } = getAuth(req)
		const body: Profile = await changePassword(prisma, { userId: user.id, sessionId }, input)
		res.status(200).json(body)
	}
