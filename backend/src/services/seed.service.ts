import { ROLE } from '../generated/prisma/enums'
import { hashPassword } from '../lib/password'
import { type PrismaClient } from '../lib/prisma'

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
