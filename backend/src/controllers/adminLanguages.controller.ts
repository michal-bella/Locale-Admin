import { type Request, type RequestHandler } from 'express'

import { createLanguageRequestSchema, languageSchema, updateLanguageRequestSchema, ERROR_CODE, type Language, type LanguagesResponse } from '@locale/shared'

import { AppError } from '../lib/errors'
import { type PrismaClient } from '../lib/prisma'
import { createLanguage, deleteLanguage, listLanguages, updateLanguage } from '../services/adminLanguages.service'

/** A non-UUID id would make Postgres fail with 500, so it is rejected as 404 before the query. */
const parseLanguageId = (req: Request): string => {
	const id = languageSchema.shape.id.safeParse(req.params.id)
	if (!id.success) {
		throw new AppError(404, ERROR_CODE.NOT_FOUND, 'Language not found')
	}
	return id.data
}

export const createListLanguagesController =
	(prisma: PrismaClient): RequestHandler =>
	async (_req, res) => {
		const body: LanguagesResponse = await listLanguages(prisma)
		res.status(200).json(body)
	}

export const createCreateLanguageController =
	(prisma: PrismaClient): RequestHandler =>
	async (req, res) => {
		const input = createLanguageRequestSchema.parse(req.body)
		const body: Language = await createLanguage(prisma, input)
		res.status(201).json(body)
	}

export const createUpdateLanguageController =
	(prisma: PrismaClient): RequestHandler =>
	async (req, res) => {
		const id = parseLanguageId(req)
		const input = updateLanguageRequestSchema.parse(req.body)
		const body: Language = await updateLanguage(prisma, id, input)
		res.status(200).json(body)
	}

export const createDeleteLanguageController =
	(prisma: PrismaClient): RequestHandler =>
	async (req, res) => {
		await deleteLanguage(prisma, parseLanguageId(req))
		res.status(204).end()
	}
