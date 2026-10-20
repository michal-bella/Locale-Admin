import { type RequestHandler } from 'express'

import { activityDailyQuerySchema, activityListQuerySchema, type ActivityDailyResponse, type ActivityListResponse } from '@locale/shared'

import { type PrismaClient } from '../lib/prisma'
import { getActivityDaily, listActivity } from '../services/activity.service'

export const createListActivityController =
	(prisma: PrismaClient): RequestHandler<{ projectId: string }> =>
	async (req, res) => {
		const query = activityListQuerySchema.parse(req.query)
		const body: ActivityListResponse = await listActivity(prisma, req.params.projectId, query)
		res.status(200).json(body)
	}

export const createGetActivityDailyController =
	(prisma: PrismaClient): RequestHandler<{ projectId: string }> =>
	async (req, res) => {
		const query = activityDailyQuerySchema.parse(req.query)
		const body: ActivityDailyResponse = await getActivityDaily(prisma, req.params.projectId, query)
		res.status(200).json(body)
	}
