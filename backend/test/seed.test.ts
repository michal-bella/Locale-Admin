import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import { describe, expect, it } from 'vitest'

import { ROLE } from '../src/generated/prisma/enums'
import { SEED_ADMIN_EMAIL, SEED_PROJECT, seedAdmin, seedProject } from '../src/services/seed.service'

import { getTestDatabaseUrl, getTestPrisma } from './helpers/db'
import { createUser } from './helpers/users'

const BACKEND_DIR = fileURLToPath(new URL('..', import.meta.url))

const runSeedScript = (env: Record<string, string | undefined>) =>
	promisify(execFile)('pnpm', ['exec', 'tsx', 'prisma/seed.ts'], { cwd: BACKEND_DIR, env: { ...process.env, ...env } })

describe('seedAdmin', () => {
	it('creates the admin once and changes nothing on the second run', async () => {
		const prisma = getTestPrisma()

		await expect(seedAdmin(prisma, 'FirstPassword1')).resolves.toBe('created')
		const created = await prisma.user.findUniqueOrThrow({ where: { email: SEED_ADMIN_EMAIL } })
		expect(created.role).toBe(ROLE.ADMIN)

		await expect(seedAdmin(prisma, 'SecondPassword2')).resolves.toBe('exists')
		const users = await prisma.user.findMany()
		expect(users).toHaveLength(1)
		expect(users[0]).toEqual(created)
	})
})

describe('seedProject', () => {
	it('creates the project with only the seeded admin as a member and changes nothing on the second run', async () => {
		const prisma = getTestPrisma()
		await seedAdmin(prisma, 'FirstPassword1')
		await createUser({ role: ROLE.ADMIN })
		const admin = await prisma.user.findUniqueOrThrow({ where: { email: SEED_ADMIN_EMAIL } })

		await expect(seedProject(prisma)).resolves.toBe('created')
		const created = await prisma.project.findMany({ include: { members: true, languages: { orderBy: { tag: 'asc' } } } })
		expect(created).toMatchObject([
			{
				...SEED_PROJECT,
				primaryColor: '#E83E8C',
				protectVariables: true,
				members: [{ userId: admin.id }],
				languages: [
					{ tag: 'en', isBase: false },
					{ tag: 'sk', isBase: true },
				],
			},
		])
		expect(created[0]?.members).toHaveLength(1)

		await expect(seedProject(prisma)).resolves.toBe('exists')
		await expect(prisma.project.findMany({ include: { members: true, languages: { orderBy: { tag: 'asc' } } } })).resolves.toEqual(created)
	})

	it('changes nothing when the table already has a project', async () => {
		const prisma = getTestPrisma()
		await seedAdmin(prisma, 'FirstPassword1')
		const project = await prisma.project.create({ data: { name: 'Renamed', slug: 'renamed' } })

		await expect(seedProject(prisma)).resolves.toBe('exists')

		await expect(prisma.project.findMany()).resolves.toEqual([project])
		await expect(prisma.projectMember.count()).resolves.toBe(0)
	})
})

describe('seed script', () => {
	it('creates the admin with a valid SEED_ADMIN_PASSWORD', async () => {
		const { stdout } = await runSeedScript({ DATABASE_URL: getTestDatabaseUrl(), SEED_ADMIN_PASSWORD: 'ValidPassword1' })

		expect(stdout).toContain('created')
		await expect(getTestPrisma().user.count()).resolves.toBe(1)
		await expect(getTestPrisma().projectLanguage.count()).resolves.toBe(2)
		await expect(getTestPrisma().project.count()).resolves.toBe(1)
		await expect(getTestPrisma().projectMember.count()).resolves.toBe(1)
	})

	it.each([
		['missing', undefined],
		['too short', 'short'],
	])('fails with a clear error when SEED_ADMIN_PASSWORD is %s', async (_case, password) => {
		const result = runSeedScript({ DATABASE_URL: getTestDatabaseUrl(), SEED_ADMIN_PASSWORD: password })

		await expect(result).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining('SEED_ADMIN_PASSWORD') as unknown })
		await expect(getTestPrisma().user.count()).resolves.toBe(0)
	})
})
