import {
	ERROR_CODE,
	SUPPORTED_LANGUAGES,
	type CreateLanguageRequest,
	type Language,
	type LanguageFlagCode,
	type LanguageTag,
	type SupportedLanguage,
	type UpdateLanguageRequest,
} from '@locale/shared'

import { Prisma, type Language as LanguageRow } from '../generated/prisma/client'
import { AppError } from '../lib/errors'
import { type PrismaClient } from '../lib/prisma'

const LANGUAGE_SELECT = {
	id: true,
	tag: true,
	englishName: true,
	nativeName: true,
	flagCode: true,
	isBase: true,
	createdAt: true,
} satisfies Prisma.LanguageSelect

/** Rows are written only from the validated API and the seed, so `tag` and `flagCode` are always catalog values. */
const toLanguage = (language: Pick<LanguageRow, keyof typeof LANGUAGE_SELECT>): Language => ({
	id: language.id,
	tag: language.tag as LanguageTag,
	englishName: language.englishName,
	nativeName: language.nativeName,
	flagCode: language.flagCode as LanguageFlagCode,
	isBase: language.isBase,
	createdAt: language.createdAt.toISOString(),
})

const isPrismaError = (err: unknown, code: string): boolean => err instanceof Prisma.PrismaClientKnownRequestError && err.code === code

const notFound = () => new AppError(404, ERROR_CODE.NOT_FOUND, 'Language not found')

/** Arbitrary app-wide key for `pg_advisory_xact_lock`; every write that reads or moves the base flag takes it. */
const BASE_LANGUAGE_LOCK_KEY = 4_815_162_342

/**
 * Serializes base-affecting writes. Without it the partial unique index `Language_isBase_key` fails under
 * concurrent requests at READ COMMITTED (e.g. two first-ever POSTs both reading `count() === 0`).
 */
const lockBaseLanguage = (tx: Prisma.TransactionClient) => tx.$executeRaw`SELECT pg_advisory_xact_lock(${BASE_LANGUAGE_LOCK_KEY})`

/** Makes the language the only base inside the caller's transaction. Returns `false` when the language does not exist. */
export const setBaseLanguage = async (tx: Prisma.TransactionClient, languageId: string): Promise<boolean> => {
	await lockBaseLanguage(tx)
	const language = await tx.language.findUnique({ where: { id: languageId }, select: { isBase: true } })
	if (!language) {
		return false
	}
	if (!language.isBase) {
		await tx.language.updateMany({ where: { isBase: true }, data: { isBase: false } })
		await tx.language.update({ where: { id: languageId }, data: { isBase: true } })
	}
	return true
}

export const getSupportedLanguage = (tag: LanguageTag): SupportedLanguage => {
	const language = SUPPORTED_LANGUAGES.find((supported) => supported.tag === tag)
	if (!language) {
		throw new Error(`Unsupported language tag ${tag}`)
	}
	return language
}

export const listLanguages = async (prisma: PrismaClient): Promise<Language[]> => {
	const languages = await prisma.language.findMany({ select: LANGUAGE_SELECT, orderBy: [{ isBase: 'desc' }, { tag: 'asc' }] })
	return languages.map(toLanguage)
}

/**
 * The first language becomes the base. No pre-check for the tag: the unique constraint (P2002) also covers concurrent requests.
 * The base lock guarantees that P2002 can only come from the tag, never from `Language_isBase_key`.
 */
export const createLanguage = async (prisma: PrismaClient, { tag }: CreateLanguageRequest): Promise<Language> => {
	const { englishName, nativeName, flagCode } = getSupportedLanguage(tag)
	try {
		const language = await prisma.$transaction(async (tx) => {
			await lockBaseLanguage(tx)
			const isBase = (await tx.language.count()) === 0
			return tx.language.create({ data: { tag, englishName, nativeName, flagCode, isBase }, select: LANGUAGE_SELECT })
		})
		return toLanguage(language)
	} catch (err) {
		if (isPrismaError(err, 'P2002')) {
			throw new AppError(409, ERROR_CODE.LANGUAGE_TAKEN, 'Language is already added')
		}
		throw err
	}
}

/** `isBase: true` moves the base flag: the old base loses it in the same transaction. */
export const updateLanguage = async (prisma: PrismaClient, id: string, { isBase, ...names }: UpdateLanguageRequest): Promise<Language> => {
	try {
		const language = await prisma.$transaction(async (tx) => {
			if (isBase && !(await setBaseLanguage(tx, id))) {
				throw notFound()
			}
			return tx.language.update({ where: { id }, data: names, select: LANGUAGE_SELECT })
		})
		return toLanguage(language)
	} catch (err) {
		if (isPrismaError(err, 'P2025')) {
			throw notFound()
		}
		throw err
	}
}

export const deleteLanguage = async (prisma: PrismaClient, id: string): Promise<void> => {
	await prisma.$transaction(async (tx) => {
		await lockBaseLanguage(tx)
		const language = await tx.language.findUnique({ where: { id }, select: { isBase: true } })
		if (!language) {
			throw notFound()
		}
		if (language.isBase) {
			throw new AppError(409, ERROR_CODE.LANGUAGE_IS_BASE, 'The base language cannot be deleted')
		}
		await tx.language.delete({ where: { id } })
	})
}
