import { type DashboardResponse } from '@locale/shared'

import { Prisma } from '../generated/prisma/client'
import { type PrismaClient } from '../lib/prisma'

const NEW_KEYS_DAYS = 30

/** Aggregates only: a project can have thousands of keys × 9 languages, the rows never leave Postgres. */
export const getDashboard = async (prisma: PrismaClient, projectId: string): Promise<DashboardResponse> => {
	const translations = Prisma.sql`"Translation" t JOIN "ProjectLanguage" l ON l.id = t."languageId" AND l."projectId" = ${projectId}::uuid`
	const [keysTotal, keysCreatedLast30Days, languages, [cells], [words]] = await Promise.all([
		prisma.translationKey.count({ where: { projectId } }),
		prisma.translationKey.count({ where: { projectId, createdAt: { gte: new Date(Date.now() - NEW_KEYS_DAYS * 86_400_000) } } }),
		prisma.projectLanguage.count({ where: { projectId } }),
		prisma.$queryRaw<[{ translatedKeys: number; filled: number }]>`
			SELECT
				(count(*) FILTER (WHERE filled = (SELECT count(*) FROM "ProjectLanguage" WHERE "projectId" = ${projectId}::uuid)))::int AS "translatedKeys",
				COALESCE(sum(filled), 0)::int AS filled
			FROM (SELECT count(*) AS filled FROM ${translations} WHERE t.value IS NOT NULL GROUP BY t."keyId") per_key`,
		prisma.$queryRaw<[{ words: number }]>`
			SELECT COALESCE(sum(regexp_count(t.value, '\\S+')), 0)::int AS words
			FROM ${translations}
			WHERE l."isBase" AND t.value IS NOT NULL`,
	])
	return {
		keys: { total: keysTotal, createdLast30Days: keysCreatedLast30Days },
		translatedKeys: cells.translatedKeys,
		strings: { filled: cells.filled, total: keysTotal * languages },
		baseWords: words.words,
	}
}
