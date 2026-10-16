import { randomUUID } from 'node:crypto'

import { ROLE } from '../../src/generated/prisma/enums'
import { hashPassword } from '../../src/lib/password'

import { getTestPrisma } from './db'

export const TEST_PASSWORD = 'TestPassword123'

export const createUser = async ({ role = ROLE.EDITOR, email, password = TEST_PASSWORD }: { role?: ROLE; email?: string; password?: string } = {}) => {
	const user = await getTestPrisma().user.create({
		data: { email: email ?? `user-${randomUUID()}@example.com`, passwordHash: await hashPassword(password), role },
	})
	return { user, password }
}
