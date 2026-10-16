import { HEALTH_STATUS, type HealthResponse } from '@locale/shared'

import { type PrismaClient } from '../lib/prisma'

const DB_CHECK_TIMEOUT_MS = 2000

export const checkDatabase = async (prisma: PrismaClient, timeoutMs = DB_CHECK_TIMEOUT_MS): Promise<HealthResponse['db']> => {
	const startedAt = performance.now()
	let timer: NodeJS.Timeout | undefined
	try {
		await Promise.race([
			prisma.$queryRaw`SELECT 1`,
			new Promise((_resolve, reject) => {
				timer = setTimeout(() => reject(new Error(`Database check timed out after ${timeoutMs} ms`)), timeoutMs)
			}),
		])
		return { status: HEALTH_STATUS.OK, latencyMs: Math.round(performance.now() - startedAt) }
	} catch {
		return { status: HEALTH_STATUS.ERROR, latencyMs: null }
	} finally {
		clearTimeout(timer)
	}
}
