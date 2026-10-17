import { type LanguageTag } from '@locale/shared'

import { ROLE } from '../generated/prisma/enums'
import { hashPassword } from '../lib/password'
import { type PrismaClient } from '../lib/prisma'

import { getSupportedLanguage } from './adminLanguages.service'

export const SEED_ADMIN_EMAIL = 'michal.bella@goodrequest.com'

export type SeedAdminResult = 'created' | 'exists'

/** Creates the admin if missing. An existing admin is never changed (not even the password or role). */
export const seedAdmin = async (prisma: PrismaClient, password: string): Promise<SeedAdminResult> => {
	const existing = await prisma.user.findUnique({ where: { email: SEED_ADMIN_EMAIL }, select: { id: true } })
	if (existing) {
		return 'exists'
	}
	await prisma.user.create({ data: { email: SEED_ADMIN_EMAIL, passwordHash: await hashPassword(password), role: ROLE.ADMIN } })
	return 'created'
}

const SEED_BASE_LANGUAGE_TAG = 'sk' satisfies LanguageTag

export const SEED_LANGUAGE_TAGS = [SEED_BASE_LANGUAGE_TAG, 'en'] as const satisfies LanguageTag[]

export type SeedLanguagesResult = 'created' | 'exists'

/** Seeds only an empty table, so languages an ADMIN deleted do not come back on the next backend start. */
export const seedLanguages = async (prisma: PrismaClient): Promise<SeedLanguagesResult> => {
	if ((await prisma.language.count()) > 0) {
		return 'exists'
	}
	await prisma.language.createMany({
		data: SEED_LANGUAGE_TAGS.map((tag) => {
			const { englishName, nativeName, flagCode } = getSupportedLanguage(tag)
			return { tag, englishName, nativeName, flagCode, isBase: tag === SEED_BASE_LANGUAGE_TAG }
		}),
	})
	return 'created'
}
