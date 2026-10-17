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

/** The first language becomes the base. No pre-check for the tag: the unique constraint (P2002) also covers concurrent requests. */
export const createLanguage = async (prisma: PrismaClient, { tag }: CreateLanguageRequest): Promise<Language> => {
	const { englishName, nativeName, flagCode } = getSupportedLanguage(tag)
	const isBase = (await prisma.language.count()) === 0
	try {
		const language = await prisma.language.create({ data: { tag, englishName, nativeName, flagCode, isBase }, select: LANGUAGE_SELECT })
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
			if (isBase) {
				await tx.language.updateMany({ where: { isBase: true, NOT: { id } }, data: { isBase: false } })
			}
			return tx.language.update({ where: { id }, data: { ...names, ...(isBase && { isBase }) }, select: LANGUAGE_SELECT })
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
	const language = await prisma.language.findUnique({ where: { id }, select: { isBase: true } })
	if (!language) {
		throw notFound()
	}
	if (language.isBase) {
		throw new AppError(409, ERROR_CODE.LANGUAGE_IS_BASE, 'The base language cannot be deleted')
	}
	await prisma.language.deleteMany({ where: { id, isBase: false } })
}
