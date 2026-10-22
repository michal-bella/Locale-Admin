import { type RequestHandler } from 'express'

import { importPreviewRequestSchema, importRequestSchema, type ImportPreviewResponse, type ImportResult } from '@locale/shared'

import { type PrismaClient } from '../lib/prisma'
import { getAuth } from '../middleware/auth.middleware'
import { assertImportFileSize, importFile, parseImportFile, previewImport } from '../services/imports.service'

export const createPreviewImportController =
	(prisma: PrismaClient): RequestHandler<{ projectId: string }> =>
	async (req, res) => {
		assertImportFileSize(req.body)
		const { content } = importPreviewRequestSchema.parse(req.body)
		const body: ImportPreviewResponse = await previewImport(prisma, req.params.projectId, parseImportFile(content))
		res.status(200).json(body)
	}

export const createImportController =
	(prisma: PrismaClient): RequestHandler<{ projectId: string }> =>
	async (req, res) => {
		assertImportFileSize(req.body)
		const request = importRequestSchema.parse(req.body)
		const file = parseImportFile(request.content)
		const { user } = getAuth(req)
		const body: ImportResult = await importFile(prisma, { projectId: req.params.projectId, userId: user.id, role: user.role }, file, request)
		res.status(200).json(body)
	}
