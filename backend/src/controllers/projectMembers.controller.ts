import { type RequestHandler } from 'express'
import { z } from 'zod'

import { addProjectMemberRequestSchema, ERROR_CODE, type ProjectMember, type ProjectMemberListResponse } from '@locale/shared'

import { AppError } from '../lib/errors'
import { type PrismaClient } from '../lib/prisma'
import { getAuth } from '../middleware/auth.middleware'
import { addProjectMember, listProjectMembers } from '../services/projectMembers.service'
import { removeProjectMember } from '../services/projects.service'

export const createListProjectMembersController =
	(prisma: PrismaClient): RequestHandler<{ projectId: string }> =>
	async (req, res) => {
		const body: ProjectMemberListResponse = { members: await listProjectMembers(prisma, req.params.projectId) }
		res.status(200).json(body)
	}

export const createAddProjectMemberController =
	(prisma: PrismaClient): RequestHandler<{ projectId: string }> =>
	async (req, res) => {
		const input = addProjectMemberRequestSchema.parse(req.body)
		const body: ProjectMember = await addProjectMember(prisma, req.params.projectId, getAuth(req).user.id, input)
		res.status(201).json(body)
	}

export const createRemoveProjectMemberController =
	(prisma: PrismaClient): RequestHandler<{ projectId: string; userId: string }> =>
	async (req, res) => {
		if (!z.uuid().safeParse(req.params.userId).success) {
			throw new AppError(404, ERROR_CODE.NOT_FOUND, 'Not a member of the project')
		}
		await removeProjectMember(prisma, req.params.projectId, req.params.userId, getAuth(req).user.id)
		res.status(204).end()
	}
