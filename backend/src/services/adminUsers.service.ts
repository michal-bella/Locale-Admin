import { ERROR_CODE, type AdminUser, type CreateUserRequest } from '@locale/shared'

import { Prisma } from '../generated/prisma/client'
import { ROLE_FROM_PRISMA, ROLE_TO_PRISMA } from '../lib/authUser'
import { AppError } from '../lib/errors'
import { hashPassword } from '../lib/password'
import { type PrismaClient } from '../lib/prisma'

const ADMIN_USER_SELECT = { id: true, email: true, role: true, createdAt: true, _count: { select: { projectMemberships: true } } } satisfies Prisma.UserSelect

const toAdminUser = (user: Prisma.UserGetPayload<{ select: typeof ADMIN_USER_SELECT }>): AdminUser => ({
	id: user.id,
	email: user.email,
	role: ROLE_FROM_PRISMA[user.role],
	projectCount: user._count.projectMemberships,
	createdAt: user.createdAt.toISOString(),
})

export const listUsers = async (prisma: PrismaClient): Promise<AdminUser[]> => {
	const users = await prisma.user.findMany({ select: ADMIN_USER_SELECT, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] })
	return users.map(toAdminUser)
}

/** No pre-check for the email: the unique constraint (P2002) also covers concurrent requests. */
export const createUser = async (prisma: PrismaClient, { email, password, role }: CreateUserRequest): Promise<AdminUser> => {
	const passwordHash = await hashPassword(password)
	try {
		const user = await prisma.user.create({
			data: { email, passwordHash, role: ROLE_TO_PRISMA[role], passwordChangedAt: new Date() },
			select: ADMIN_USER_SELECT,
		})
		return toAdminUser(user)
	} catch (err) {
		if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
			throw new AppError(409, ERROR_CODE.EMAIL_TAKEN, 'Email is already taken')
		}
		throw err
	}
}

/** Deletes any user; sessions and project memberships cascade. Nobody deletes their own account, so at least one admin always stays. */
export const deleteUser = async (prisma: PrismaClient, id: string, currentUserId: string): Promise<void> => {
	if (id === currentUserId) {
		throw new AppError(409, ERROR_CODE.SELF_DELETE, 'A user cannot delete their own account')
	}
	const { count } = await prisma.user.deleteMany({ where: { id } })
	if (count === 0) {
		throw new AppError(404, ERROR_CODE.NOT_FOUND, 'User not found')
	}
}
