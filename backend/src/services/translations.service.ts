import {
	ERROR_CODE,
	TRANSLATION_KEY_PATH_PATTERN,
	VALIDATION_CODE,
	parsePluralValue,
	serializePluralValue,
	translationGroup,
	type TranslationKeyPlural,
	type TranslationListItem,
	type TranslationsQuery,
	type TranslationsResponse,
	type TranslationsSort,
	type UpdateTranslationKeyRequest,
	type UpdateTranslationKeyResponse,
	type UpdateTranslationResponse,
} from '@locale/shared'

import { Prisma } from '../generated/prisma/client'
import { AppError } from '../lib/errors'
import { comparePlaceholders, placeholders } from '../lib/placeholders'
import { type PrismaClient } from '../lib/prisma'

import { isPrismaError } from './projects.service'

type ItemRow = {
	keyId: string
	namespace: string
	name: string
	group: string
	description: string | null
	pluralVariable: string | null
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
	KEY: Prisma.sql`k.namespace, "group", k.name, k.id`,
	UPDATED: Prisma.sql`t."updatedAt" DESC NULLS LAST, k.name, k.id`,
}

const toPlural = (pluralVariable: string | null): TranslationKeyPlural | null => (pluralVariable === null ? null : { variable: pluralVariable })

const toItem = (row: ItemRow): TranslationListItem => ({
	keyId: row.keyId,
	namespace: row.namespace,
	name: row.name,
	group: row.group,
	description: row.description,
	plural: toPlural(row.pluralVariable),
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
			SELECT k.id AS "keyId", k.namespace, k.name, ${GROUP_SQL} AS "group", k.description, k."pluralVariable",
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

const keyNotFound = () => new AppError(404, ERROR_CODE.TRANSLATION_KEY_NOT_FOUND, 'Translation key not found')

/**
 * Upserts the target cell. On a plural key a non-null value must be a plural message with the key's variable. With
 * `protectVariables` a non-base value must keep the `{{…}}` placeholders of the base language value (skipped when
 * that is missing or `null`). No advisory lock: a concurrent import stays consistent, only its counts may be off by
 * this row (plan, "Odložené z míľnika A").
 */
export const updateTranslation = async (
	prisma: PrismaClient,
	{ projectId, keyId, languageId, userId }: { projectId: string; keyId: string; languageId: string; userId: string },
	value: string | null,
): Promise<UpdateTranslationResponse> => {
	const key = await prisma.translationKey.findFirst({
		where: { id: keyId, projectId },
		select: { pluralVariable: true, project: { select: { protectVariables: true } } },
	})
	if (!key) {
		throw keyNotFound()
	}
	const language = await prisma.projectLanguage.findFirst({ where: { id: languageId, projectId }, select: { isBase: true } })
	if (!language) {
		throw new AppError(404, ERROR_CODE.NOT_FOUND, 'Language not found')
	}

	if (value !== null && key.pluralVariable !== null && parsePluralValue(value)?.variable !== key.pluralVariable) {
		throw new AppError(400, ERROR_CODE.VALIDATION_ERROR, 'Value of a plural key must be a plural message with the key variable', [
			{ path: 'value', code: VALIDATION_CODE.INVALID },
		])
	}

	if (value !== null && !language.isBase && key.project.protectVariables) {
		const base = await prisma.translation.findFirst({ where: { keyId, language: { projectId, isBase: true } }, select: { value: true } })
		if (base?.value != null) {
			const { missing, extra } = comparePlaceholders(placeholders(base.value), value)
			if (missing.length > 0 || extra.length > 0) {
				throw new AppError(400, ERROR_CODE.PLACEHOLDER_MISMATCH, 'Placeholders differ from the base language', { missing, extra })
			}
		}
	}

	const row = await prisma.translation.upsert({
		where: { keyId_languageId: { keyId, languageId } },
		create: { keyId, languageId, value, updatedById: userId },
		update: { value, updatedById: userId },
		select: { value: true, updatedAt: true },
	})
	return { value: row.value, status: row.value === null ? 'UNTRANSLATED' : 'TRANSLATED', updatedAt: row.updatedAt.toISOString() }
}

/**
 * Value of one language after the plural setting of its key changed. Plural on wraps the text as the `other` form
 * (a text that already is a plural message keeps its forms); plural off keeps the `other` form; a new variable
 * re-serializes the forms. A value that is not a plural message stays as is.
 */
export const convertPluralValue = (value: string, from: string | null, to: string | null): string => {
	if (from === null) {
		return to === null ? value : serializePluralValue({ variable: to, forms: parsePluralValue(value)?.forms ?? { other: value } })
	}
	const parsed = parsePluralValue(value)
	if (!parsed) {
		return value
	}
	return to === null ? (parsed.forms.other ?? value) : serializePluralValue({ variable: to, forms: parsed.forms })
}

/**
 * Renames the key, sets its description or plural setting; a plural change converts every non-null value in the same
 * transaction and marks the converted rows as updated by the acting user.
 */
export const updateTranslationKey = async (
	prisma: PrismaClient,
	{ projectId, keyId, userId }: { projectId: string; keyId: string; userId: string },
	{ name, description, plural }: UpdateTranslationKeyRequest,
): Promise<UpdateTranslationKeyResponse> =>
	prisma.$transaction(async (tx) => {
		const key = await tx.translationKey.findFirst({ where: { id: keyId, projectId }, select: { pluralVariable: true } })
		if (!key) {
			throw keyNotFound()
		}
		const pluralVariable = plural === undefined ? key.pluralVariable : (plural?.variable ?? null)
		if (pluralVariable !== key.pluralVariable) {
			const rows = await tx.translation.findMany({ where: { keyId, value: { not: null } }, select: { languageId: true, value: true } })
			for (const row of rows) {
				const value = convertPluralValue(row.value ?? '', key.pluralVariable, pluralVariable)
				if (value !== row.value) {
					await tx.translation.update({ where: { keyId_languageId: { keyId, languageId: row.languageId } }, data: { value, updatedById: userId } })
				}
			}
		}
		const updated = await tx.translationKey
			.update({
				where: { id: keyId },
				data: { name, description, pluralVariable },
				select: { id: true, namespace: true, name: true, description: true, pluralVariable: true },
			})
			.catch((err: unknown) => {
				if (isPrismaError(err, 'P2002')) {
					throw new AppError(409, ERROR_CODE.TRANSLATION_KEY_TAKEN, 'Translation key name is already taken in this namespace')
				}
				throw err
			})
		return {
			keyId: updated.id,
			namespace: updated.namespace,
			name: updated.name,
			group: translationGroup(updated.namespace, updated.name),
			description: updated.description,
			plural: toPlural(updated.pluralVariable),
		}
	})
