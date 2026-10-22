import { type RequestHandler } from 'express'

import { dashboardQuerySchema, type DashboardResponse } from '@locale/shared'

import { type PrismaClient } from '../lib/prisma'
import { getDashboard } from '../services/dashboard.service'

export const createGetDashboardController =
	(prisma: PrismaClient): RequestHandler<{ projectId: string }> =>
	async (req, res) => {
		const body: DashboardResponse = await getDashboard(prisma, req.params.projectId, dashboardQuerySchema.parse(req.query))
		res.status(200).json(body)
	}
