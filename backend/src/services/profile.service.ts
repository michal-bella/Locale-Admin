import { type Profile, type UpdateProfileRequest } from '@locale/shared'

import { type Prisma, type User } from '../generated/prisma/client'
import { toAuthUser } from '../lib/authUser'
import { type PrismaClient } from '../lib/prisma'

const PROFILE_SELECT = {
	id: true,
	email: true,
	role: true,
	firstName: true,
	lastName: true,
	passwordChangedAt: true,
} satisfies Prisma.UserSelect

const toProfile = (user: Pick<User, 'id' | 'email' | 'role' | 'firstName' | 'lastName' | 'passwordChangedAt'>): Profile => ({
	...toAuthUser(user),
	passwordChangedAt: user.passwordChangedAt.toISOString(),
})

export const getProfile = async (prisma: PrismaClient, userId: string): Promise<Profile> => {
	const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: PROFILE_SELECT })
	return toProfile(user)
}

export const updateProfile = async (prisma: PrismaClient, userId: string, { firstName, lastName }: UpdateProfileRequest): Promise<Profile> => {
	const user = await prisma.user.update({ where: { id: userId }, data: { firstName, lastName }, select: PROFILE_SELECT })
	return toProfile(user)
}
