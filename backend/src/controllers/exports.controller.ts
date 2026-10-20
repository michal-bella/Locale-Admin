import { once } from 'node:events'

import { type RequestHandler } from 'express'

import { EXPORT_FILE_NAME_DEFAULT, exportQuerySchema } from '@locale/shared'

import { type PrismaClient } from '../lib/prisma'
import { exportCsv } from '../services/exports.service'

export const createExportController =
	(prisma: PrismaClient): RequestHandler<{ projectId: string }> =>
	async (req, res) => {
		const query = exportQuerySchema.parse(req.query)
		const closed = new AbortController()
		res.on('close', () => closed.abort())
		await exportCsv(prisma, req.params.projectId, query, {
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
		})
		res.end()
	}
