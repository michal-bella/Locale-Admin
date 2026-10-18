import { type RequestHandler } from 'express'

import { createProjectMemberRequestSchema, type ProjectMember, type ProjectMemberListResponse } from '@locale/shared'

import { type PrismaClient } from '../lib/prisma'
import { createProjectMember, listProjectMembers } from '../services/projectMembers.service'

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
