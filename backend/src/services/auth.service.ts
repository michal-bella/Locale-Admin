import { ERROR_CODE, type AuthUser, type LoginRequest } from '@locale/shared'

import { type Prisma } from '../generated/prisma/client'
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

/**
 * Creates the session of a user who proved who they are (password or Google). `previousToken` is the session cookie sent with the request;
 * its session is replaced by the new one. `userData` is written to the user together with `lastLoginAt`.
 */
export const startSession = async (
	prisma: PrismaClient,
	userId: string,
	config: SessionConfig,
	previousToken?: string,
	userData: Prisma.UserUpdateInput = {},
): Promise<LoginResult> => {
	const now = new Date()
	const { token, data } = buildNewSession(userId, config, now)
	const [, updatedUser, session] = await prisma.$transaction([
		prisma.session.deleteMany({
			where: { OR: [{ expiresAt: { lt: now } }, ...(previousToken ? [{ tokenHash: hashSessionToken(previousToken) }] : [])] },
		}),
		prisma.user.update({ where: { id: userId }, data: { ...userData, lastLoginAt: now } }),
		prisma.session.create({ data }),
	])

	return { user: toAuthUser(updatedUser), token, expiresAt: session.expiresAt }
}

/** A user without a password (Google only) is checked against the dummy hash, so the answer does not tell that the account exists. */
export const login = async (prisma: PrismaClient, { email, password }: LoginRequest, config: SessionConfig, previousToken?: string): Promise<LoginResult> => {
	const user = await prisma.user.findUnique({ where: { email } })
	const passwordMatches = await verifyPassword(user?.passwordHash ?? (await getDummyPasswordHash()), password)
	if (!user?.passwordHash || !passwordMatches || !user.isActive) {
		throw invalidCredentials()
	}
	return startSession(prisma, user.id, config, previousToken)
}
