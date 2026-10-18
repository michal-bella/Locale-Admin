import { type RequestHandler } from 'express'
import { z } from 'zod'

import { createProjectMemberRequestSchema, ERROR_CODE, type ProjectMember, type ProjectMemberListResponse } from '@locale/shared'

import { AppError } from '../lib/errors'
import { type PrismaClient } from '../lib/prisma'
import { createProjectMember, listProjectMembers } from '../services/projectMembers.service'
import { removeProjectMember } from '../services/projects.service'

export const createListProjectMembersController =
	(prisma: PrismaClient): RequestHandler<{ projectId: string }> =>
	async (req, res) => {
		const body: ProjectMemberListResponse = { members: await listProjectMembers(prisma, req.params.projectId) }
		res.status(200).json(body)
	}

export const createCreateProjectMemberController =
	(prisma: PrismaClient): RequestHandler<{ projectId: string }> =>
	async (req, res) => {
		const input = createProjectMemberRequestSchema.parse(req.body)
		const body: ProjectMember = await createProjectMember(prisma, req.params.projectId, input)
		res.status(201).json(body)
	}

export const createRemoveProjectMemberController =
	(prisma: PrismaClient): RequestHandler<{ projectId: string; userId: string }> =>
	async (req, res) => {
		if (!z.uuid().safeParse(req.params.userId).success) {
			throw new AppError(404, ERROR_CODE.NOT_FOUND, 'Not a member of the project')
		}
		await removeProjectMember(prisma, req.params.projectId, req.params.userId)
		res.status(204).end()
	}
