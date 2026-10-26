import { randomUUID } from 'node:crypto'

import { type PROJECT_ROLE, ROLE as SHARED_ROLE, type ProjectAccessRole } from '@locale/shared'

import { ROLE } from '../../src/generated/prisma/enums'
import { hashPassword } from '../../src/lib/password'

import { getTestPrisma } from './db'

export const TEST_PASSWORD = 'TestPassword123'

type CreateUserOptions = {
	role?: ROLE
	email?: string
	password?: string
	isActive?: boolean
	firstName?: string
	lastName?: string
	createdAt?: Date
}

export const createUser = async ({ role = ROLE.USER, email, password = TEST_PASSWORD, ...rest }: CreateUserOptions = {}) => {
	const user = await getTestPrisma().user.create({
		data: { email: email ?? `user-${randomUUID()}@example.com`, passwordHash: await hashPassword(password), role, ...rest },
	})
	return { user, password }
}

/** Role of a test user in its project: `ADMIN` (works without a membership) or the membership role of a `USER`. */
export type TestRole = ProjectAccessRole

export const globalRoleOf = (role: TestRole): ROLE => (role === SHARED_ROLE.ADMIN ? ROLE.ADMIN : ROLE.USER)

/** The membership role for `role`; an ADMIN's own membership rows (if a test makes any) keep the default. */
export const memberRoleOf = (role: TestRole): PROJECT_ROLE | undefined => (role === SHARED_ROLE.ADMIN ? undefined : role)
