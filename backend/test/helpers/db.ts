import { inject } from 'vitest'

import { createPrismaClient, type PrismaClient } from '../../src/lib/prisma'

let prisma: PrismaClient | undefined

export const getTestDatabaseUrl = (): string => inject('databaseUrl')

export const getTestPrisma = (): PrismaClient => {
	prisma ??= createPrismaClient(getTestDatabaseUrl())
	return prisma
}

export const truncateAllTables = async (): Promise<void> => {
	const tables = await getTestPrisma().$queryRaw<{ tablename: string }[]>`
		SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
	`
	if (tables.length === 0) {
		return
	}
	const list = tables.map(({ tablename }) => `"public"."${tablename.replaceAll('"', '""')}"`).join(', ')
	await getTestPrisma().$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`)
}

export const disconnectTestPrisma = async (): Promise<void> => {
	await prisma?.$disconnect()
	prisma = undefined
}
