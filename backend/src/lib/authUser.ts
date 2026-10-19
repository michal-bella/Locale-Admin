import { ROLE, type AuthUser } from '@locale/shared'

import { type User } from '../generated/prisma/client'
import { ROLE as PRISMA_ROLE } from '../generated/prisma/enums'

export const ROLE_FROM_PRISMA: Record<PRISMA_ROLE, ROLE> = {
	ADMIN: ROLE.ADMIN,
	EDITOR: ROLE.EDITOR,
}

export const ROLE_TO_PRISMA: Record<ROLE, PRISMA_ROLE> = {
	[ROLE.ADMIN]: PRISMA_ROLE.ADMIN,
	[ROLE.EDITOR]: PRISMA_ROLE.EDITOR,
}

export const toAuthUser = (user: Pick<User, 'id' | 'email' | 'role' | 'firstName' | 'lastName'>): AuthUser => ({
	id: user.id,
	email: user.email,
	role: ROLE_FROM_PRISMA[user.role],
	firstName: user.firstName,
	lastName: user.lastName,
})
