import { ROLE, type AuthUser } from '@locale/shared'

import { type User } from '../generated/prisma/client'
import { type ROLE as PRISMA_ROLE } from '../generated/prisma/enums'

const ROLE_FROM_PRISMA: Record<PRISMA_ROLE, ROLE> = {
	ADMIN: ROLE.ADMIN,
	EDITOR: ROLE.EDITOR,
}

export const toAuthUser = (user: Pick<User, 'id' | 'email' | 'role' | 'firstName' | 'lastName'>): AuthUser => ({
	id: user.id,
	email: user.email,
	role: ROLE_FROM_PRISMA[user.role],
	firstName: user.firstName,
	lastName: user.lastName,
})
