import { Router } from 'express'

import { createHealthController } from '../controllers/health.controller'
import { type PrismaClient } from '../lib/prisma'

export const createHealthRouter = (prisma: PrismaClient, appVersion: string): Router => {
	const router = Router()
	router.get('/', createHealthController(prisma, appVersion))
	return router
}
