import { ERROR_CODE, type AuthUser, type LoginRequest } from '@locale/shared'

import { toAuthUser } from '../lib/authUser'
import { AppError } from '../lib/errors'
import { getDummyPasswordHash, verifyPassword } from '../lib/password'
import { type PrismaClient } from '../lib/prisma'

import { buildNewSession, hashSessionToken, type SessionConfig } from './session.service'

export type LoginResult = {
	user: AuthUser
	token: string
	expiresAt: Date
}

const invalidCredentials = () => new AppError(401, ERROR_CODE.AUTH_INVALID_CREDENTIALS, 'Invalid email or password')

/** `previousToken` is the session cookie sent with the login request; its session is replaced by the new one. */
export const login = async (prisma: PrismaClient, { email, password }: LoginRequest, config: SessionConfig, previousToken?: string): Promise<LoginResult> => {
	const user = await prisma.user.findUnique({ where: { email } })
	const passwordMatches = await verifyPassword(user?.passwordHash ?? (await getDummyPasswordHash()), password)
	if (!user || !passwordMatches || !user.isActive) {
		throw invalidCredentials()
	}

	const now = new Date()
	const { token, data } = buildNewSession(user.id, config, now)
	const [, updatedUser, session] = await prisma.$transaction([
		prisma.session.deleteMany({
			where: { OR: [{ expiresAt: { lt: now } }, ...(previousToken ? [{ tokenHash: hashSessionToken(previousToken) }] : [])] },
		}),
		prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: now } }),
		prisma.session.create({ data }),
	])

	return { user: toAuthUser(updatedUser), token, expiresAt: session.expiresAt }
}
