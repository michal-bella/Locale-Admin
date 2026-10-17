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

/**
 * Creates the missing seed languages; existing ones are never changed.
 * `sk` becomes the base only when there is no base yet, otherwise the partial unique index on `isBase` would fail the seed.
 */
export const seedLanguages = async (prisma: PrismaClient): Promise<void> => {
	const hasBase = (await prisma.language.count({ where: { isBase: true } })) > 0
	for (const tag of SEED_LANGUAGE_TAGS) {
		const { englishName, nativeName, flagCode } = getSupportedLanguage(tag)
		await prisma.language.upsert({
			where: { tag },
			create: { tag, englishName, nativeName, flagCode, isBase: !hasBase && tag === SEED_BASE_LANGUAGE_TAG },
			update: {},
		})
	}
}
