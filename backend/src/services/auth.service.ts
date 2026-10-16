import { ERROR_CODE, type AuthUser, type LoginRequest } from '@locale/shared'

import { toAuthUser } from '../lib/authUser'
import { AppError } from '../lib/errors'
import { getDummyPasswordHash, verifyPassword } from '../lib/password'
import { type PrismaClient } from '../lib/prisma'

import { buildNewSession, type SessionConfig } from './session.service'

export type LoginResult = {
	user: AuthUser
	token: string
	expiresAt: Date
}

const invalidCredentials = () => new AppError(401, ERROR_CODE.AUTH_INVALID_CREDENTIALS, 'Invalid email or password')

export const login = async (prisma: PrismaClient, { email, password }: LoginRequest, config: SessionConfig): Promise<LoginResult> => {
	const user = await prisma.user.findUnique({ where: { email } })
	const passwordMatches = await verifyPassword(user?.passwordHash ?? (await getDummyPasswordHash()), password)
	if (!user || !passwordMatches || !user.isActive) {
		throw invalidCredentials()
	}

	const now = new Date()
	const { token, data } = buildNewSession(user.id, config, now)
	const [, updatedUser, session] = await prisma.$transaction([
		prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }),
		prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: now } }),
		prisma.session.create({ data }),
	])

	return { user: toAuthUser(updatedUser), token, expiresAt: session.expiresAt }
}
