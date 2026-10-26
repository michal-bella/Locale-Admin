import { type Request, type RequestHandler } from 'express'
import { z } from 'zod'

import { ERROR_CODE, type ProjectAccessRole } from '@locale/shared'

import { AppError } from '../lib/errors'
import { type PrismaClient } from '../lib/prisma'
import { getProjectRole as findProjectRole } from '../services/projects.service'

import { getAuth } from './auth.middleware'

declare global {
	// Express request augmentation only works with a namespace and an interface.
	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace Express {
		// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
		interface Request {
			/** Set by `requireProjectAccess`. */
			projectRole?: ProjectAccessRole
		}
	}
}

/** Returns the role in `:projectId` of a request that went through `requireProjectAccess`. */
export const getProjectRole = (req: Request): ProjectAccessRole => {
	if (!req.projectRole) {
		throw new AppError(404, ERROR_CODE.NOT_FOUND, 'Project not found')
	}
	return req.projectRole
}

/** Lets through an ADMIN or a member of `:projectId` and keeps their role in the project. Anyone else gets 404, so the project's existence is not revealed. */
export const createRequireProjectAccess =
	(prisma: PrismaClient): RequestHandler<{ projectId: string }> =>
	async (req, _res, next) => {
		const { projectId } = req.params
		const role = z.uuid().safeParse(projectId).success ? await findProjectRole(prisma, projectId, getAuth(req).user) : null
		if (!role) {
			next(new AppError(404, ERROR_CODE.NOT_FOUND, 'Project not found'))
			return
		}
		req.projectRole = role
		next()
	}

/** After `requireProjectAccess`: 403 unless the user's role in the project is one of `roles`. */
export const requireProjectRole =
	(...roles: ProjectAccessRole[]): RequestHandler =>
	(req, _res, next) => {
		if (!roles.includes(getProjectRole(req))) {
			next(new AppError(403, ERROR_CODE.FORBIDDEN, 'Insufficient role'))
			return
		}
		next()
	}
