import { type RequestHandler } from 'express'

import { translationsQuerySchema, type TranslationsResponse } from '@locale/shared'

import { type PrismaClient } from '../lib/prisma'
import { listTranslations } from '../services/translations.service'

export const createListTranslationsController =
	(prisma: PrismaClient): RequestHandler<{ projectId: string }> =>
	async (req, res) => {
		const query = translationsQuerySchema.parse(req.query)
		const body: TranslationsResponse = await listTranslations(prisma, req.params.projectId, query)
		res.status(200).json(body)
	}
