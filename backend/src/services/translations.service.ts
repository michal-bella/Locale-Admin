import {
	ERROR_CODE,
	TRANSLATION_KEY_PATH_PATTERN,
	type TranslationListItem,
	type TranslationsQuery,
	type TranslationsResponse,
	type TranslationsSort,
} from '@locale/shared'

import { Prisma } from '../generated/prisma/client'
import { AppError } from '../lib/errors'
import { type PrismaClient } from '../lib/prisma'

type ItemRow = {
	keyId: string
	namespace: string
	name: string
	group: string
	sourceValue: string | null
	targetValue: string | null
	targetUpdatedAt: Date | null
}

/** `\` is the default ILIKE escape character, so it is escaped too. */
const toContainsPattern = (search: string) => `%${search.replace(/[\\%_]/g, '\\$&')}%`

/** Same result as `translationGroup()` from `@locale/shared`; a path key matches the pattern, so it always has a dot. */
const GROUP_SQL = Prisma.sql`CASE
	WHEN k.name ~ ${TRANSLATION_KEY_PATH_PATTERN} THEN
		CASE WHEN k.namespace = '' THEN '' ELSE k.namespace || ':' END || regexp_replace(k.name, '[.][^.]*$', '')
	ELSE k.namespace
END`

const ORDER_BY: Record<TranslationsSort, Prisma.Sql> = {
	UNTRANSLATED_FIRST: Prisma.sql`(t.value IS NULL) DESC, "group", k.name, k.id`,
	KEY: Prisma.sql`k.namespace, k.name, k.id`,
	UPDATED: Prisma.sql`t."updatedAt" DESC NULLS LAST, k.name, k.id`,
}

const toItem = (row: ItemRow): TranslationListItem => ({
	keyId: row.keyId,
	namespace: row.namespace,
	name: row.name,
	group: row.group,
	source: { value: row.sourceValue },
	target: {
		value: row.targetValue,
		status: row.targetValue === null ? 'UNTRANSLATED' : 'TRANSLATED',
		updatedAt: row.targetUpdatedAt?.toISOString() ?? null,
	},
})

const assertProjectLanguages = async (prisma: PrismaClient, projectId: string, languageIds: string[]) => {
	const ids = [...new Set(languageIds)]
	const found = await prisma.projectLanguage.count({ where: { projectId, id: { in: ids } } })
	if (found !== ids.length) {
		throw new AppError(404, ERROR_CODE.NOT_FOUND, 'Language not found')
	}
}

/** Missing target rows and `null` values are untranslated. `stats` and `namespaces` ignore the filters. */
export const listTranslations = async (prisma: PrismaClient, projectId: string, query: TranslationsQuery): Promise<TranslationsResponse> => {
	const { sourceLanguageId, targetLanguageId, search, status, namespace, sort, page, pageSize } = query
	await assertProjectLanguages(prisma, projectId, [sourceLanguageId, targetLanguageId])

	const conditions = [Prisma.sql`k."projectId" = ${projectId}::uuid`]
	if (search !== undefined) {
		const pattern = toContainsPattern(search)
		conditions.push(Prisma.sql`(k.name ILIKE ${pattern} OR s.value ILIKE ${pattern} OR t.value ILIKE ${pattern})`)
	}
	if (status !== undefined) {
		conditions.push(status === 'UNTRANSLATED' ? Prisma.sql`t.value IS NULL` : Prisma.sql`t.value IS NOT NULL`)
	}
	if (namespace !== undefined) {
		conditions.push(Prisma.sql`k.namespace = ${namespace}`)
	}
	const from = Prisma.sql`"TranslationKey" k
		LEFT JOIN "Translation" s ON s."keyId" = k.id AND s."languageId" = ${sourceLanguageId}::uuid
		LEFT JOIN "Translation" t ON t."keyId" = k.id AND t."languageId" = ${targetLanguageId}::uuid
		WHERE ${Prisma.join(conditions, ' AND ')}`

	const [rows, [count], [stats], namespaces] = await Promise.all([
		prisma.$queryRaw<ItemRow[]>`
			SELECT k.id AS "keyId", k.namespace, k.name, ${GROUP_SQL} AS "group",
				s.value AS "sourceValue", t.value AS "targetValue", t."updatedAt" AS "targetUpdatedAt"
			FROM ${from}
			ORDER BY ${ORDER_BY[sort]}
			LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
		prisma.$queryRaw<[{ total: number }]>`SELECT count(*)::int AS total FROM ${from}`,
		prisma.$queryRaw<[{ totalKeys: number; translated: number }]>`
			SELECT count(*)::int AS "totalKeys", count(t.value)::int AS translated
			FROM "TranslationKey" k
			LEFT JOIN "Translation" t ON t."keyId" = k.id AND t."languageId" = ${targetLanguageId}::uuid
			WHERE k."projectId" = ${projectId}::uuid`,
		prisma.translationKey.findMany({ where: { projectId }, distinct: ['namespace'], select: { namespace: true }, orderBy: { namespace: 'asc' } }),
	])

	return {
		items: rows.map(toItem),
		total: count.total,
		page,
		pageSize,
		stats: { totalKeys: stats.totalKeys, translated: stats.translated, untranslated: stats.totalKeys - stats.translated },
		namespaces: namespaces.map((row) => row.namespace),
	}
}
