import { type DashboardQuery, type DashboardResponse } from '@locale/shared'

import { Prisma } from '../generated/prisma/client'
import { type PrismaClient } from '../lib/prisma'
import { assertProjectVersion, findDefaultVersionId, todayVersionDate } from '../lib/projectVersions'

const NEW_KEYS_DAYS = 30

const EMPTY: DashboardResponse = { version: null, keys: { total: 0, createdLast30Days: 0 }, translatedKeys: 0, strings: { filled: 0, total: 0 }, baseWords: 0 }

/**
 * Aggregates of one version (the requested one, else the project's default: current, else newest; every count 0 without versions):
 * a version can have thousands of keys × 9 languages, the rows never leave Postgres.
 */
export const getDashboard = async (prisma: PrismaClient, projectId: string, query: DashboardQuery): Promise<DashboardResponse> => {
	const versionId = query.versionId ?? (await findDefaultVersionId(prisma, projectId, todayVersionDate()))
	if (versionId === null) {
		return EMPTY
	}
	const version = await assertProjectVersion(prisma, projectId, versionId)
	const translations = Prisma.sql`"Translation" t JOIN "TranslationKey" k ON k.id = t."keyId" AND k."versionId" = ${versionId}::uuid JOIN "ProjectLanguage" l ON l.id = t."languageId"`
	const [keysTotal, keysCreatedLast30Days, languages, [cells], [words]] = await Promise.all([
		prisma.translationKey.count({ where: { versionId } }),
		prisma.translationKey.count({ where: { versionId, createdAt: { gte: new Date(Date.now() - NEW_KEYS_DAYS * 86_400_000) } } }),
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
		version: { id: version.id, name: version.name },
		keys: { total: keysTotal, createdLast30Days: keysCreatedLast30Days },
		translatedKeys: cells.translatedKeys,
		strings: { filled: cells.filled, total: keysTotal * languages },
		baseWords: words.words,
	}
}
