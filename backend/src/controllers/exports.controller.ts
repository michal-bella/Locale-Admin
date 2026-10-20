import { once } from 'node:events'

import { type RequestHandler } from 'express'

import { ERROR_CODE, EXPORT_FILE_NAME_DEFAULT, exportQuerySchema } from '@locale/shared'

import { type Config } from '../config/env'
import { createConcurrencyLimiter } from '../lib/concurrencyLimiter'
import { AppError } from '../lib/errors'
import { type PrismaClient } from '../lib/prisma'
import { exportCsv } from '../services/exports.service'

export const createExportController = (prisma: PrismaClient, config: Config): RequestHandler<{ projectId: string }> => {
	const limiter = createConcurrencyLimiter({
		maxActive: config.exportMaxConcurrent,
		queueMax: config.exportQueueMax,
		queueTimeoutMs: config.exportQueueTimeoutMs,
	})
	const retryAfterSeconds = String(Math.ceil(config.exportQueueTimeoutMs / 1000))

	return async (req, res) => {
		const query = exportQuerySchema.parse(req.query)
		const closed = new AbortController()
		// The client may have left during auth or the access check, before this listener exists (seen in the load test).
		if (res.destroyed) {
			closed.abort()
		}
		res.on('close', () => closed.abort())

		const release = await limiter.acquire(closed.signal)
		if (!release) {
			if (closed.signal.aborted) {
				return
			}
			res.set('Retry-After', retryAfterSeconds)
			throw new AppError(429, ERROR_CODE.EXPORT_BUSY, 'Too many exports at once')
		}
		// A client that stops reading would keep the slot and the transaction; the abort also ends a wait for `drain`.
		const timer = setTimeout(() => {
			closed.abort()
			res.destroy()
		}, config.exportTimeoutMs)
		const startedAt = performance.now()
		try {
			const keys = await exportCsv(
				prisma,
				req.params.projectId,
				query,
				{
					signal: closed.signal,
					start: () => {
						res.status(200).set({
							'Content-Type': 'text/csv; charset=utf-8',
							'Content-Disposition': `attachment; filename="${EXPORT_FILE_NAME_DEFAULT}.csv"`,
							'Cache-Control': 'no-store',
						})
					},
					// Backpressure: wait until the client takes the chunk. A closed connection ends the wait; the export then stops before the next batch.
					write: async (chunk) => {
						if (!res.write(chunk)) {
							await once(res, 'drain', { signal: closed.signal }).catch(() => undefined)
						}
					},
				},
				config.exportTimeoutMs,
			)
			res.end()
			// The load tests (scripts/load) read the heap from this line to spot leaks.
			req.log.info(
				{
					keys,
					aborted: res.destroyed,
					durationMs: Math.round(performance.now() - startedAt),
					heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1048576),
				},
				'Export finished',
			)
		} finally {
			clearTimeout(timer)
			release()
		}
	}
}
