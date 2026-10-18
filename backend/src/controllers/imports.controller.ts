import { type RequestHandler } from 'express'

import { importPreviewRequestSchema, type ImportPreviewResponse } from '@locale/shared'

import { type PrismaClient } from '../lib/prisma'
import { assertImportFileSize, parseImportFile, previewImport } from '../services/imports.service'

export const createPreviewImportController =
	(prisma: PrismaClient): RequestHandler<{ projectId: string }> =>
	async (req, res) => {
		assertImportFileSize(req.body)
		const { content } = importPreviewRequestSchema.parse(req.body)
		const body: ImportPreviewResponse = await previewImport(prisma, req.params.projectId, parseImportFile(content))
		res.status(200).json(body)
	}
