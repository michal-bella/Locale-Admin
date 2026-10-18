import { type RequestHandler } from 'express'
import { z } from 'zod'

import { ERROR_CODE, type AdminProjectListResponse } from '@locale/shared'

import { AppError } from '../lib/errors'
import { type PrismaClient } from '../lib/prisma'
import { deleteProject, listAllProjects } from '../services/adminProjects.service'

export const createListAllProjectsController =
	(prisma: PrismaClient): RequestHandler =>
	async (_req, res) => {
		const body: AdminProjectListResponse = { projects: await listAllProjects(prisma) }
		res.status(200).json(body)
	}

export const createDeleteProjectController =
	(prisma: PrismaClient): RequestHandler<{ projectId: string }> =>
	async (req, res) => {
		if (!z.uuid().safeParse(req.params.projectId).success) {
			throw new AppError(404, ERROR_CODE.NOT_FOUND, 'Project not found')
		}
		await deleteProject(prisma, req.params.projectId)
		res.status(204).end()
	}
