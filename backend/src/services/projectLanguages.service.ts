import {
	ERROR_CODE,
	SUPPORTED_LANGUAGES,
	VALIDATION_CODE,
	type CreateLanguageRequest,
	type Language,
	type LanguageTag,
	type ReorderLanguagesRequest,
	type SupportedLanguage,
} from '@locale/shared'

import { type Prisma, type ProjectLanguage } from '../generated/prisma/client'
import { AppError } from '../lib/errors'
import { type PrismaClient } from '../lib/prisma'

import { isPrismaError } from './projects.service'

const LANGUAGE_SELECT = { id: true, tag: true, isBase: true, createdAt: true } satisfies Prisma.ProjectLanguageSelect

export const getSupportedLanguage = (tag: LanguageTag): SupportedLanguage => {
	const language = SUPPORTED_LANGUAGES.find((supported) => supported.tag === tag)
	if (!language) {
		throw new Error(`Unsupported language tag ${tag}`)
	}
	return language
}

/** Rows are written only from the validated API and the seed, so `tag` is always a catalog value; names and flag come from the catalog. */
const toLanguage = (language: Pick<ProjectLanguage, keyof typeof LANGUAGE_SELECT>): Language => {
	const { englishName, nativeName, flagCode } = getSupportedLanguage(language.tag as LanguageTag)
	return {
		id: language.id,
		tag: language.tag as LanguageTag,
		englishName,
		nativeName,
		flagCode,
		isBase: language.isBase,
		createdAt: language.createdAt.toISOString(),
	}
}

/** The base language is always first; the rest keep their drag and drop position (it also stays when the base is changed in the settings). */
const LANGUAGE_ORDER = [{ isBase: 'desc' }, { position: 'asc' }, { tag: 'asc' }] satisfies Prisma.ProjectLanguageOrderByWithRelationInput[]

const notFound = () => new AppError(404, ERROR_CODE.NOT_FOUND, 'Language not found')

/**
 * Serializes writes that read or move the base flag of one project. Without it the partial unique index
 * `ProjectLanguage_projectId_isBase_key` fails under concurrent requests at READ COMMITTED (e.g. two first POSTs both reading `count() === 0`).
 */
const lockProject = (tx: Prisma.TransactionClient, projectId: string) => tx.$queryRaw`SELECT id FROM "Project" WHERE id = ${projectId}::uuid FOR UPDATE`

/** Makes the language the only base of its project inside the caller's transaction. Returns `false` when it is not a language of the project. */
export const setBaseLanguage = async (tx: Prisma.TransactionClient, projectId: string, languageId: string): Promise<boolean> => {
	await lockProject(tx, projectId)
	const language = await tx.projectLanguage.findFirst({ where: { id: languageId, projectId }, select: { isBase: true } })
	if (!language) {
		return false
	}
	if (!language.isBase) {
		await tx.projectLanguage.updateMany({ where: { projectId, isBase: true }, data: { isBase: false } })
		await tx.projectLanguage.update({ where: { id: languageId }, data: { isBase: true } })
	}
	return true
}

export const findBaseLanguageId = async (prisma: PrismaClient | Prisma.TransactionClient, projectId: string): Promise<string | null> =>
	(await prisma.projectLanguage.findFirst({ where: { projectId, isBase: true }, select: { id: true } }))?.id ?? null

export const listProjectLanguages = async (prisma: PrismaClient, projectId: string): Promise<Language[]> => {
	const languages = await prisma.projectLanguage.findMany({ where: { projectId }, select: LANGUAGE_SELECT, orderBy: LANGUAGE_ORDER })
	return languages.map(toLanguage)
}

/**
 * The first language of the project becomes the base, a new one goes last. No pre-check for the tag: the unique constraint (P2002) also covers concurrent requests.
 * The project lock guarantees that P2002 can only come from the tag, never from the base index.
 */
export const createProjectLanguage = async (prisma: PrismaClient, projectId: string, { tag }: CreateLanguageRequest): Promise<Language> => {
	try {
		const language = await prisma.$transaction(async (tx) => {
			await lockProject(tx, projectId)
			const { _count, _max } = await tx.projectLanguage.aggregate({ where: { projectId }, _count: true, _max: { position: true } })
			const position = _max.position === null ? 0 : _max.position + 1
			return tx.projectLanguage.create({ data: { projectId, tag, isBase: _count === 0, position }, select: LANGUAGE_SELECT })
		})
		return toLanguage(language)
	} catch (err) {
		if (isPrismaError(err, 'P2002')) {
			throw new AppError(409, ERROR_CODE.LANGUAGE_TAKEN, 'Language is already added')
		}
		throw err
	}
}

export const deleteProjectLanguage = async (prisma: PrismaClient, projectId: string, id: string): Promise<void> => {
	await prisma.$transaction(async (tx) => {
		await lockProject(tx, projectId)
		const language = await tx.projectLanguage.findFirst({ where: { id, projectId }, select: { isBase: true } })
		if (!language) {
			throw notFound()
		}
		if (language.isBase) {
			throw new AppError(409, ERROR_CODE.LANGUAGE_IS_BASE, 'The base language cannot be deleted')
		}
		await tx.projectLanguage.delete({ where: { id } })
	})
}

/**
 * Replaces the order with `languageIds`, which must be exactly the languages of the project (400 otherwise, nothing is written,
 * e.g. when another member added or removed one meanwhile). The first one becomes the base in the same transaction.
 */
export const reorderProjectLanguages = async (prisma: PrismaClient, projectId: string, { languageIds }: ReorderLanguagesRequest): Promise<Language[]> =>
	prisma.$transaction(async (tx) => {
		await lockProject(tx, projectId)
		const current = await tx.projectLanguage.findMany({ where: { projectId }, select: { id: true } })
		const ids = new Set(current.map(({ id }) => id))
		if (current.length !== languageIds.length || languageIds.some((id) => !ids.has(id))) {
			throw new AppError(400, ERROR_CODE.VALIDATION_ERROR, 'The languages do not match the project', [
				{ path: 'languageIds', code: VALIDATION_CODE.INVALID },
			])
		}
		await Promise.all(languageIds.map((id, position) => tx.projectLanguage.update({ where: { id }, data: { position } })))
		await setBaseLanguage(tx, projectId, languageIds[0] as string)
		const languages = await tx.projectLanguage.findMany({ where: { projectId }, select: LANGUAGE_SELECT, orderBy: LANGUAGE_ORDER })
		return languages.map(toLanguage)
	})
