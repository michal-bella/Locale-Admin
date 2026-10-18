import { ERROR_CODE, SUPPORTED_LANGUAGES, type CreateLanguageRequest, type Language, type LanguageTag, type SupportedLanguage } from '@locale/shared'

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
	const languages = await prisma.projectLanguage.findMany({ where: { projectId }, select: LANGUAGE_SELECT, orderBy: [{ isBase: 'desc' }, { tag: 'asc' }] })
	return languages.map(toLanguage)
}

/**
 * The first language of the project becomes the base. No pre-check for the tag: the unique constraint (P2002) also covers concurrent requests.
 * The project lock guarantees that P2002 can only come from the tag, never from the base index.
 */
export const createProjectLanguage = async (prisma: PrismaClient, projectId: string, { tag }: CreateLanguageRequest): Promise<Language> => {
	try {
		const language = await prisma.$transaction(async (tx) => {
			await lockProject(tx, projectId)
			const isBase = (await tx.projectLanguage.count({ where: { projectId } })) === 0
			return tx.projectLanguage.create({ data: { projectId, tag, isBase }, select: LANGUAGE_SELECT })
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
