import { type Request, type RequestHandler } from 'express'

import { createLanguageRequestSchema, languageSchema, reorderLanguagesRequestSchema, ERROR_CODE, type Language, type LanguagesResponse } from '@locale/shared'

import { AppError } from '../lib/errors'
import { type PrismaClient } from '../lib/prisma'
import { createProjectLanguage, deleteProjectLanguage, listProjectLanguages, reorderProjectLanguages } from '../services/projectLanguages.service'

type Params = { projectId: string; languageId: string }

/** A non-UUID id would make Postgres fail with 500, so it is rejected as 404 before the query. */
const parseLanguageId = (req: Request<Params>): string => {
	const id = languageSchema.shape.id.safeParse(req.params.languageId)
	if (!id.success) {
		throw new AppError(404, ERROR_CODE.NOT_FOUND, 'Language not found')
	}
	return id.data
}

export const createListProjectLanguagesController =
	(prisma: PrismaClient): RequestHandler<Pick<Params, 'projectId'>> =>
	async (req, res) => {
		const body: LanguagesResponse = await listProjectLanguages(prisma, req.params.projectId)
		res.status(200).json(body)
	}

export const createCreateProjectLanguageController =
	(prisma: PrismaClient): RequestHandler<Pick<Params, 'projectId'>> =>
	async (req, res) => {
		const input = createLanguageRequestSchema.parse(req.body)
		const body: Language = await createProjectLanguage(prisma, req.params.projectId, input)
		res.status(201).json(body)
	}

export const createDeleteProjectLanguageController =
	(prisma: PrismaClient): RequestHandler<Params> =>
	async (req, res) => {
		await deleteProjectLanguage(prisma, req.params.projectId, parseLanguageId(req))
		res.status(204).end()
	}

export const createReorderProjectLanguagesController =
	(prisma: PrismaClient): RequestHandler<Pick<Params, 'projectId'>> =>
	async (req, res) => {
		const body: LanguagesResponse = await reorderProjectLanguages(prisma, req.params.projectId, reorderLanguagesRequestSchema.parse(req.body))
		res.status(200).json(body)
	}
