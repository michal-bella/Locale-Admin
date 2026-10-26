import {
	type AuthUser,
	type ChangePasswordRequest,
	ERROR_CODE,
	type Profile,
	ROLE,
	type UpdatePreferencesRequest,
	type UpdateProfileRequest,
} from '@locale/shared'

import { type Prisma, type User } from '../generated/prisma/client'
import { type AuthUserRow, ROLE_TO_PRISMA, toAuthUser } from '../lib/authUser'
import { AppError } from '../lib/errors'
import { hashPassword, verifyPassword } from '../lib/password'
import { type PrismaClient } from '../lib/prisma'

import { deleteUserSessions } from './session.service'

const PROFILE_SELECT = {
	id: true,
	email: true,
	role: true,
	firstName: true,
	lastName: true,
	translationsView: true,
	translationsLayout: true,
	passwordHash: true,
	passwordChangedAt: true,
} satisfies Prisma.UserSelect

const toProfile = (user: AuthUserRow & Pick<User, 'passwordHash' | 'passwordChangedAt'>): Profile => ({
	...toAuthUser(user),
	hasPassword: user.passwordHash !== null,
	passwordChangedAt: user.passwordChangedAt?.toISOString() ?? null,
})

export const getProfile = async (prisma: PrismaClient, userId: string): Promise<Profile> => {
	const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: PROFILE_SELECT })
	return toProfile(user)
}

/** Only an ADMIN changes their own role, and never away from ADMIN when nobody else has it. */
export const updateProfile = async (
	prisma: PrismaClient,
	me: Pick<AuthUser, 'id' | 'role'>,
	{ firstName, lastName, role }: UpdateProfileRequest,
): Promise<Profile> => {
	const changesRole = role !== undefined && role !== me.role
	if (changesRole && me.role !== ROLE.ADMIN) {
		throw new AppError(403, ERROR_CODE.FORBIDDEN, 'Only an admin can change their role')
	}
	if (changesRole && (await prisma.user.count({ where: { role: ROLE_TO_PRISMA[ROLE.ADMIN] } })) <= 1) {
		throw new AppError(409, ERROR_CODE.LAST_ADMIN, 'The last admin cannot give up the admin role')
	}
	const user = await prisma.user.update({
		where: { id: me.id },
		data: { firstName, lastName, ...(changesRole && { role: ROLE_TO_PRISMA[role] }) },
		select: PROFILE_SELECT,
	})
	return toProfile(user)
}

export const updatePreferences = async (
	prisma: PrismaClient,
	userId: string,
	{ translationsView, translationsLayout }: UpdatePreferencesRequest,
): Promise<Profile> => {
	const user = await prisma.user.update({ where: { id: userId }, data: { translationsView, translationsLayout }, select: PROFILE_SELECT })
	return toProfile(user)
}

/** Signs the user out on every other device (`sessionId` is the caller's session). A user without a password gets one only from an ADMIN. */
export const changePassword = async (
	prisma: PrismaClient,
	{ userId, sessionId }: { userId: string; sessionId: string },
	{ currentPassword, newPassword }: ChangePasswordRequest,
): Promise<Profile> => {
	const { passwordHash } = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true } })
	if (!passwordHash) {
		throw new AppError(409, ERROR_CODE.PASSWORD_NOT_SET, 'The user has no password')
	}
	if (!(await verifyPassword(passwordHash, currentPassword))) {
		throw new AppError(400, ERROR_CODE.PASSWORD_INCORRECT, 'The current password is incorrect')
	}
	const user = await prisma.user.update({
		where: { id: userId },
		data: { passwordHash: await hashPassword(newPassword), passwordChangedAt: new Date() },
		select: PROFILE_SELECT,
	})
	await deleteUserSessions(prisma, userId, sessionId)
	return toProfile(user)
}
