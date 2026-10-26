import { ERROR_CODE, ROLE, type AdminUser, type AdminUserDetail, type CreateUserRequest, type UpdateUserRequest } from '@locale/shared'

import { Prisma } from '../generated/prisma/client'
import { PROJECT_ROLE_FROM_PRISMA, ROLE_FROM_PRISMA, ROLE_TO_PRISMA } from '../lib/authUser'
import { AppError } from '../lib/errors'
import { hashPassword } from '../lib/password'
import { type PrismaClient } from '../lib/prisma'

const ADMIN_USER_SELECT = { id: true, email: true, role: true, createdAt: true, _count: { select: { projectMemberships: true } } } satisfies Prisma.UserSelect

const emailTaken = () => new AppError(409, ERROR_CODE.EMAIL_TAKEN, 'Email is already taken')

const toAdminUser = (user: Prisma.UserGetPayload<{ select: typeof ADMIN_USER_SELECT }>): AdminUser => ({
	id: user.id,
	email: user.email,
	role: ROLE_FROM_PRISMA[user.role],
	projectCount: user._count.projectMemberships,
	createdAt: user.createdAt.toISOString(),
})

const ADMIN_USER_DETAIL_SELECT = {
	...ADMIN_USER_SELECT,
	projectMemberships: {
		select: { role: true, createdAt: true, project: { select: { id: true, name: true, slug: true, primaryColor: true } } },
		orderBy: [{ project: { name: 'asc' } }, { projectId: 'asc' }],
	},
} satisfies Prisma.UserSelect

export const getUser = async (prisma: PrismaClient, id: string): Promise<AdminUserDetail> => {
	const user = await prisma.user.findUnique({ where: { id }, select: ADMIN_USER_DETAIL_SELECT })
	if (!user) {
		throw new AppError(404, ERROR_CODE.NOT_FOUND, 'User not found')
	}
	return {
		...toAdminUser(user),
		projects: user.projectMemberships.map(({ role, createdAt, project }) => ({
			...project,
			role: PROJECT_ROLE_FROM_PRISMA[role],
			joinedAt: createdAt.toISOString(),
		})),
	}
}

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
			throw emailTaken()
		}
		throw err
	}
}

/**
 * Changes the global role and/or the email of any user, the own account included; the last ADMIN keeps the role so that somebody can
 * manage users. A new ADMIN keeps their memberships with the roles, they apply again once the admin role is taken away (`ACTIVE_MEMBERSHIP`).
 * No pre-check for the email: the unique constraint (P2002) also covers concurrent requests.
 */
export const updateUser = async (prisma: PrismaClient, id: string, { role, email }: UpdateUserRequest): Promise<AdminUserDetail> => {
	const user = await prisma.user.findUnique({ where: { id }, select: { role: true } })
	if (!user) {
		throw new AppError(404, ERROR_CODE.NOT_FOUND, 'User not found')
	}
	if (
		role !== undefined &&
		ROLE_FROM_PRISMA[user.role] === ROLE.ADMIN &&
		role !== ROLE.ADMIN &&
		(await prisma.user.count({ where: { role: ROLE_TO_PRISMA[ROLE.ADMIN] } })) <= 1
	) {
		throw new AppError(409, ERROR_CODE.LAST_ADMIN, 'The last admin cannot lose the admin role')
	}
	try {
		await prisma.user.update({ where: { id }, data: { role: role && ROLE_TO_PRISMA[role], email }, select: { id: true } })
	} catch (err) {
		if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
			throw emailTaken()
		}
		throw err
	}
	return getUser(prisma, id)
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
