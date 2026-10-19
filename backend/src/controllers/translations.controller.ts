import { type RequestHandler } from 'express'
import { z } from 'zod'

import { ERROR_CODE, translationsQuerySchema, updateTranslationRequestSchema, type TranslationsResponse, type UpdateTranslationResponse } from '@locale/shared'

import { AppError } from '../lib/errors'
import { type PrismaClient } from '../lib/prisma'
import { getAuth } from '../middleware/auth.middleware'
import { listTranslations, updateTranslation } from '../services/translations.service'

type Params = { projectId: string; keyId: string; languageId: string }

/** A non-UUID id would make Postgres fail with 500, so it is rejected with the same 404 as an unknown id. */
const parseId = (value: string, code: ERROR_CODE, message: string): string => {
	const id = z.uuid().safeParse(value)
	if (!id.success) {
		throw new AppError(404, code, message)
	}
	return id.data
}

export const createListTranslationsController =
	(prisma: PrismaClient): RequestHandler<Pick<Params, 'projectId'>> =>
	async (req, res) => {
		const query = translationsQuerySchema.parse(req.query)
		const body: TranslationsResponse = await listTranslations(prisma, req.params.projectId, query)
		res.status(200).json(body)
	}

export const createUpdateTranslationController =
	(prisma: PrismaClient): RequestHandler<Params> =>
	async (req, res) => {
		const keyId = parseId(req.params.keyId, ERROR_CODE.TRANSLATION_KEY_NOT_FOUND, 'Translation key not found')
		const languageId = parseId(req.params.languageId, ERROR_CODE.NOT_FOUND, 'Language not found')
		const { value } = updateTranslationRequestSchema.parse(req.body)
		const ids = { projectId: req.params.projectId, keyId, languageId, userId: getAuth(req).user.id }
		const body: UpdateTranslationResponse = await updateTranslation(prisma, ids, value)
		res.status(200).json(body)
	}
