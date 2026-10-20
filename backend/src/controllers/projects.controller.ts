import { type RequestHandler } from 'express'

import { createProjectRequestSchema, type ProjectListItem, type ProjectListResponse, reorderProjectsRequestSchema } from '@locale/shared'

import { type PrismaClient } from '../lib/prisma'
import { getAuth } from '../middleware/auth.middleware'
import { createProject, listProjects, removeProjectMember, reorderProjects } from '../services/projects.service'

export const createListProjectsController =
	(prisma: PrismaClient): RequestHandler =>
	async (req, res) => {
		const body: ProjectListResponse = { projects: await listProjects(prisma, getAuth(req).user) }
		res.status(200).json(body)
	}

export const createCreateProjectController =
	(prisma: PrismaClient): RequestHandler =>
	async (req, res) => {
		const input = createProjectRequestSchema.parse(req.body)
		const body: ProjectListItem = await createProject(prisma, getAuth(req).user.id, input)
		res.status(201).json(body)
	}

export const createLeaveProjectController =
	(prisma: PrismaClient): RequestHandler<{ projectId: string }> =>
	async (req, res) => {
		await removeProjectMember(prisma, req.params.projectId, getAuth(req).user.id)
		res.status(204).end()
	}

export const createReorderProjectsController =
	(prisma: PrismaClient): RequestHandler =>
	async (req, res) => {
		await reorderProjects(prisma, getAuth(req).user, reorderProjectsRequestSchema.parse(req.body))
		res.status(204).end()
	}
