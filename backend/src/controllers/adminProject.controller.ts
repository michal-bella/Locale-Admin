import { type RequestHandler } from 'express'

import { updateProjectSettingsRequestSchema, type ProjectSettings } from '@locale/shared'

import { type PrismaClient } from '../lib/prisma'
import { getProjectSettings, updateProjectSettings } from '../services/adminProject.service'

export const createGetProjectSettingsController =
	(prisma: PrismaClient): RequestHandler =>
	async (_req, res) => {
		const body: ProjectSettings = await getProjectSettings(prisma)
		res.status(200).json(body)
	}

export const createUpdateProjectSettingsController =
	(prisma: PrismaClient): RequestHandler =>
	async (req, res) => {
		const input = updateProjectSettingsRequestSchema.parse(req.body)
		const body: ProjectSettings = await updateProjectSettings(prisma, input)
		res.status(200).json(body)
	}
