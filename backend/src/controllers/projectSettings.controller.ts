import { type RequestHandler } from 'express'

import { updateProjectSettingsRequestSchema, type ProjectSettings } from '@locale/shared'

import { type PrismaClient } from '../lib/prisma'
import { getAuth } from '../middleware/auth.middleware'
import { getProjectSettings, updateProjectSettings } from '../services/projectSettings.service'

export const createGetProjectSettingsController =
	(prisma: PrismaClient): RequestHandler<{ projectId: string }> =>
	async (req, res) => {
		const body: ProjectSettings = await getProjectSettings(prisma, req.params.projectId)
		res.status(200).json(body)
	}

export const createUpdateProjectSettingsController =
	(prisma: PrismaClient): RequestHandler<{ projectId: string }> =>
	async (req, res) => {
		const input = updateProjectSettingsRequestSchema.parse(req.body)
		const body: ProjectSettings = await updateProjectSettings(prisma, req.params.projectId, getAuth(req).user, input)
		res.status(200).json(body)
	}
