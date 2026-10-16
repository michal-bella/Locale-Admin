import { type RequestHandler } from 'express'

import { HEALTH_STATUS, type HealthResponse } from '@locale/shared'

import { type PrismaClient } from '../lib/prisma'
import { checkDatabase } from '../services/health.service'

export const createHealthController =
	(prisma: PrismaClient, appVersion: string): RequestHandler =>
	async (_req, res) => {
		const db = await checkDatabase(prisma)
		const body: HealthResponse = { status: db.status, version: appVersion, db }
		res.status(db.status === HEALTH_STATUS.OK ? 200 : 503).json(body)
	}
