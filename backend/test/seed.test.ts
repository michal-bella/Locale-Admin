import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import { describe, expect, it } from 'vitest'

import { ROLE } from '../src/generated/prisma/enums'
import { SEED_ADMIN_EMAIL, seedAdmin, seedLanguages } from '../src/services/seed.service'

import { getTestDatabaseUrl, getTestPrisma } from './helpers/db'

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

describe('seedLanguages', () => {
	it('creates sk as the base and en once and changes nothing on the second run', async () => {
		const prisma = getTestPrisma()

		await seedLanguages(prisma)
		const created = await prisma.language.findMany({ orderBy: { tag: 'asc' } })
		expect(created).toMatchObject([
			{ tag: 'en', englishName: 'English', nativeName: 'English', flagCode: 'gb', isBase: false },
			{ tag: 'sk', englishName: 'Slovak', nativeName: 'slovenčina', flagCode: 'sk', isBase: true },
		])

		await prisma.language.update({ where: { tag: 'en' }, data: { englishName: 'English (UK)' } })
		await seedLanguages(prisma)
		const after = await prisma.language.findMany({ orderBy: { tag: 'asc' } })
		expect(after).toHaveLength(2)
		expect(after[0]?.englishName).toBe('English (UK)')
		expect(after[1]).toEqual(created[1])
	})

	it('adds a missing sk as not base when another language is the base', async () => {
		const prisma = getTestPrisma()
		await prisma.language.create({ data: { tag: 'ru', englishName: 'Russian', nativeName: 'русский', flagCode: 'ru', isBase: true } })

		await seedLanguages(prisma)

		const bases = await prisma.language.findMany({ where: { isBase: true } })
		expect(bases.map(({ tag }) => tag)).toEqual(['ru'])
		await expect(prisma.language.count()).resolves.toBe(3)
	})
})

describe('seed script', () => {
	it('creates the admin with a valid SEED_ADMIN_PASSWORD', async () => {
		const { stdout } = await runSeedScript({ DATABASE_URL: getTestDatabaseUrl(), SEED_ADMIN_PASSWORD: 'ValidPassword1' })

		expect(stdout).toContain('created')
		await expect(getTestPrisma().user.count()).resolves.toBe(1)
		await expect(getTestPrisma().language.count()).resolves.toBe(2)
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
