import { once } from 'node:events'

import { type RequestHandler } from 'express'

import { ERROR_CODE, EXPORT_FILE_NAME_DEFAULT, type ExportCheckResponse, exportCheckQuerySchema, type ExportFormat, exportQuerySchema } from '@locale/shared'

import { type Config } from '../config/env'
import { createConcurrencyLimiter } from '../lib/concurrencyLimiter'
import { AppError } from '../lib/errors'
import { type PrismaClient } from '../lib/prisma'
import { checkExport, exportTranslations } from '../services/exports.service'

const CONTENT_TYPES: Record<ExportFormat, string> = {
	CSV: 'text/csv; charset=utf-8',
	XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

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
		// Backpressure: wait until the client takes what was written. A closed connection ends the wait; the export then stops before the next batch.
		const drained = async () => {
			if (res.writableNeedDrain) {
				await once(res, 'drain', { signal: closed.signal }).catch(() => undefined)
			}
		}
		try {
			const keys = await exportTranslations(
				prisma,
				req.params.projectId,
				query,
				{
					signal: closed.signal,
					stream: res,
					start: () => {
						res.status(200).set({
							'Content-Type': CONTENT_TYPES[query.format],
							'Content-Disposition': `attachment; filename="${EXPORT_FILE_NAME_DEFAULT}.${query.format.toLowerCase()}"`,
							'Cache-Control': 'no-store',
						})
					},
					write: async (chunk) => {
						res.write(chunk)
						await drained()
					},
					drained,
				},
				config.exportTimeoutMs,
			)
			// Before `end()`: the XLSX writer ends the response itself, so `destroyed` alone would mark every XLSX as aborted.
			const aborted = closed.signal.aborted && !res.writableFinished
			res.end()
			// The load tests (scripts/load) read the heap from this line to spot leaks.
			req.log.info(
				{
					keys,
					aborted,
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

export const createExportCheckController =
	(prisma: PrismaClient): RequestHandler<{ projectId: string }> =>
	async (req, res) => {
		const body: ExportCheckResponse = await checkExport(prisma, req.params.projectId, exportCheckQuerySchema.parse(req.query))
		res.status(200).json(body)
	}
