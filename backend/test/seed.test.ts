import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import { describe, expect, it } from 'vitest'

import { ACTIVITY_TYPE, activityEventDataSchema } from '@locale/shared'

import { ROLE } from '../src/generated/prisma/enums'
import { SEED_ADMIN_EMAIL, SEED_PREVIOUS_KEY_COUNT, SEED_PROJECT, SEED_TRANSLATIONS, seedAdmin, seedProject } from '../src/services/seed.service'

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
	it('creates the project without members and changes nothing on the second run', async () => {
		const prisma = getTestPrisma()
		await seedAdmin(prisma, 'FirstPassword1')
		await createUser({ role: ROLE.ADMIN })

		await expect(seedProject(prisma)).resolves.toBe('created')
		const created = await prisma.project.findMany({ include: { members: true, languages: { orderBy: { tag: 'asc' } } } })
		expect(created).toMatchObject([
			{
				...SEED_PROJECT,
				primaryColor: '#E83E8C',
				protectVariables: true,
				members: [],
				languages: [
					{ tag: 'en', isBase: false },
					{ tag: 'sk', isBase: true },
				],
			},
		])

		await prisma.translation.updateMany({ data: { value: 'edited' } })
		await expect(seedProject(prisma)).resolves.toBe('exists')
		await expect(prisma.translationKey.count()).resolves.toBe(SEED_TRANSLATIONS.length + SEED_PREVIOUS_KEY_COUNT)
		await expect(prisma.translation.count({ where: { value: { not: 'edited' } } })).resolves.toBe(0)
		await expect(prisma.project.findMany({ include: { members: true, languages: { orderBy: { tag: 'asc' } } } })).resolves.toEqual(created)
	})

	it('changes nothing when the table already has a project', async () => {
		const prisma = getTestPrisma()
		await seedAdmin(prisma, 'FirstPassword1')
		const project = await prisma.project.create({ data: { name: 'Renamed', slug: 'renamed' } })

		await expect(seedProject(prisma)).resolves.toBe('exists')

		await expect(prisma.project.findMany()).resolves.toEqual([project])
		await expect(prisma.projectMember.count()).resolves.toBe(0)
		await expect(prisma.translationKey.count()).resolves.toBe(0)
	})

	it('creates the sample translations with the project: two namespaces, path keys, missing rows and null values', async () => {
		const prisma = getTestPrisma()
		await seedAdmin(prisma, 'FirstPassword1')

		await expect(seedProject(prisma)).resolves.toBe('created')
		const keys = await prisma.translationKey.findMany({
			where: { version: { importedAt: { not: null }, endsAt: { gte: new Date() } } },
			include: { translations: { include: { language: true } } },
		})
		expect(keys).toHaveLength(SEED_TRANSLATIONS.length)
		expect(new Set(keys.map(({ namespace }) => namespace))).toEqual(new Set(['loc', 'paths']))
		expect(keys.some(({ name }) => name === 'orders.empty.title')).toBe(true)
		const en = keys.map(({ translations }) => translations.find(({ language }) => language.tag === 'en'))
		expect(en.some((row) => row === undefined)).toBe(true)
		expect(en.some((row) => row !== undefined && row.value === null)).toBe(true)
		const values = keys.flatMap(({ translations }) => translations.map(({ value }) => value ?? ''))
		expect(values.some((value) => value.includes('{{'))).toBe(true)
		expect(values.some((value) => value.includes('<strong>'))).toBe(true)
	})

	it('creates valid sample activity of the admin over the last 30 days with some empty days, and none on the second run', async () => {
		const prisma = getTestPrisma()
		await seedAdmin(prisma, 'FirstPassword1')
		const admin = await prisma.user.findUniqueOrThrow({ where: { email: SEED_ADMIN_EMAIL } })

		await seedProject(prisma)
		const events = await prisma.activityEvent.findMany({ orderBy: { createdAt: 'asc' } })
		expect(events.map(({ type, payload }) => activityEventDataSchema.parse({ type, payload }).type)).toEqual(
			expect.arrayContaining([ACTIVITY_TYPE.PROJECT_CREATED, ACTIVITY_TYPE.KEYS_IMPORTED, ACTIVITY_TYPE.TRANSLATION_UPDATED]),
		)
		expect(events[0]?.type).toBe(ACTIVITY_TYPE.PROJECT_CREATED)
		expect(events.every(({ userId }) => userId === admin.id)).toBe(true)
		const daysAgo = new Set(events.map(({ createdAt }) => Math.floor((Date.now() - createdAt.getTime()) / (24 * 60 * 60 * 1000))))
		expect(Math.max(...daysAgo)).toBeLessThanOrEqual(30)
		expect(daysAgo.size).toBeLessThan(31)

		await seedProject(prisma)
		await expect(prisma.activityEvent.count()).resolves.toBe(events.length)
	})
})

describe('seed script', () => {
	it('creates the admin with a valid SEED_ADMIN_PASSWORD', async () => {
		const { stdout } = await runSeedScript({ DATABASE_URL: getTestDatabaseUrl(), SEED_ADMIN_PASSWORD: 'ValidPassword1' })

		expect(stdout).toContain('created')
		await expect(getTestPrisma().user.count()).resolves.toBe(1)
		await expect(getTestPrisma().projectLanguage.count()).resolves.toBe(2)
		await expect(getTestPrisma().project.count()).resolves.toBe(1)
		await expect(getTestPrisma().projectMember.count()).resolves.toBe(0)
		await expect(getTestPrisma().translationKey.count()).resolves.toBe(SEED_TRANSLATIONS.length + SEED_PREVIOUS_KEY_COUNT)
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
