import { type AuthUser, ERROR_CODE, type Profile, ROLE, type UpdatePreferencesRequest, type UpdateProfileRequest } from '@locale/shared'

import { type Prisma, type User } from '../generated/prisma/client'
import { type AuthUserRow, ROLE_TO_PRISMA, toAuthUser } from '../lib/authUser'
import { AppError } from '../lib/errors'
import { type PrismaClient } from '../lib/prisma'

const PROFILE_SELECT = {
	id: true,
	email: true,
	role: true,
	firstName: true,
	lastName: true,
	translationsView: true,
	passwordChangedAt: true,
} satisfies Prisma.UserSelect

const toProfile = (user: AuthUserRow & Pick<User, 'passwordChangedAt'>): Profile => ({
	...toAuthUser(user),
	passwordChangedAt: user.passwordChangedAt.toISOString(),
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

export const updatePreferences = async (prisma: PrismaClient, userId: string, { translationsView }: UpdatePreferencesRequest): Promise<Profile> => {
	const user = await prisma.user.update({ where: { id: userId }, data: { translationsView }, select: PROFILE_SELECT })
	return toProfile(user)
}
