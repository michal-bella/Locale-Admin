import { type RequestHandler } from 'express'
import { z } from 'zod'

import { ERROR_CODE } from '@locale/shared'

import { AppError } from '../lib/errors'
import { type PrismaClient } from '../lib/prisma'
import { hasProjectAccess } from '../services/projects.service'

import { getAuth } from './auth.middleware'

/** Lets through an ADMIN or a member of `:projectId`. Anyone else gets 404, so the project's existence is not revealed. */
export const createRequireProjectAccess =
	(prisma: PrismaClient): RequestHandler<{ projectId: string }> =>
	async (req, _res, next) => {
		const { projectId } = req.params
		if (!z.uuid().safeParse(projectId).success || !(await hasProjectAccess(prisma, projectId, getAuth(req).user))) {
			next(new AppError(404, ERROR_CODE.NOT_FOUND, 'Project not found'))
			return
		}
		next()
	}
