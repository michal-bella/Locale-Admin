import {
	ERROR_CODE,
	TRANSLATION_KEY_PATH_PATTERN,
	VALIDATION_CODE,
	normalizePluralValue,
	parsePluralValue,
	serializePluralValue,
	translationGroup,
	type TranslationCell,
	type TranslationEditor,
	type TranslationKeyPlural,
	type TranslationListItem,
	type TranslationsQuery,
	type TranslationsResponse,
	type TranslationsSort,
	type TranslationStatus,
	type TranslationsUpdatedWithin,
	type UpdateTranslationKeyRequest,
	type UpdateTranslationKeyResponse,
	type UpdateTranslationResponse,
} from '@locale/shared'

import { Prisma, type Translation } from '../generated/prisma/client'
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
	untranslated: boolean
}

type EditorRow = { id: string; email: string; firstName: string | null; lastName: string | null }

type CellRow = Pick<Translation, 'keyId' | 'languageId' | 'value' | 'updatedAt'> & { updatedBy: EditorRow | null }

const EDITOR_SELECT = { select: { id: true, email: true, firstName: true, lastName: true } } as const

const toEditor = ({ id, email, firstName, lastName }: EditorRow): TranslationEditor => ({
	id,
	name: [firstName, lastName].filter(Boolean).join(' ') || email,
})

/** `\` is the default ILIKE escape character, so it is escaped too. */
const toContainsPattern = (search: string) => `%${search.replace(/[\\%_]/g, '\\$&')}%`

/** Case- and diacritics-insensitive contains: both sides go through `unaccent`, so "vlastni" and "vlastní" find each other. */
const matches = (column: Prisma.Sql, pattern: string) => Prisma.sql`unaccent(${column}) ILIKE unaccent(${pattern})`

/** Same result as `translationGroup()` from `@locale/shared`; a path key matches the pattern, so it always has a dot. */
const GROUP_SQL = Prisma.sql`CASE
	WHEN k.name ~ ${TRANSLATION_KEY_PATH_PATTERN} THEN
		CASE WHEN k.namespace = '' THEN '' ELSE k.namespace || ':' END || regexp_replace(k.name, '[.][^.]*$', '')
	ELSE k.namespace
END`

/**
 * SQL of one view over `"TranslationKey" k`. `untranslated` decides the row status, the `status` filter, `UNTRANSLATED_FIRST`
 * and `stats`; `updatedAt` is the time `UPDATED` sorts by; `valueMatches` is the value part of `search`.
 */
type ViewSql = {
	joins: Prisma.Sql
	untranslated: Prisma.Sql
	updatedAt: Prisma.Sql
	valueMatches: (pattern: string) => Prisma.Sql
	/** A translation of the view (the target, or any language) matches `condition` on the alias `x`. */
	translationMatches: (condition: Prisma.Sql) => Prisma.Sql
}

/** Compact view: the target language decides, the search also covers the source language. */
const compactView = (sourceLanguageId: string, targetLanguageId: string): ViewSql => ({
	joins: Prisma.sql`
		LEFT JOIN "Translation" s ON s."keyId" = k.id AND s."languageId" = ${sourceLanguageId}::uuid
		LEFT JOIN "Translation" t ON t."keyId" = k.id AND t."languageId" = ${targetLanguageId}::uuid`,
	untranslated: Prisma.sql`(t.value IS NULL)`,
	updatedAt: Prisma.sql`t."updatedAt"`,
	valueMatches: (pattern) => Prisma.sql`${matches(Prisma.sql`s.value`, pattern)} OR ${matches(Prisma.sql`t.value`, pattern)}`,
	translationMatches: (condition) =>
		Prisma.sql`EXISTS (SELECT 1 FROM "Translation" x WHERE x."keyId" = k.id AND x."languageId" = ${targetLanguageId}::uuid AND ${condition})`,
})

/** Extended view: a row is untranslated when any language of the project has no value (a missing row counts). */
const EXTENDED_VIEW: ViewSql = {
	joins: Prisma.empty,
	untranslated: Prisma.sql`EXISTS (
		SELECT 1 FROM "ProjectLanguage" pl
		LEFT JOIN "Translation" x ON x."keyId" = k.id AND x."languageId" = pl.id
		WHERE pl."projectId" = k."projectId" AND x.value IS NULL)`,
	updatedAt: Prisma.sql`(SELECT max(x."updatedAt") FROM "Translation" x WHERE x."keyId" = k.id)`,
	valueMatches: (pattern) => Prisma.sql`EXISTS (SELECT 1 FROM "Translation" x WHERE x."keyId" = k.id AND ${matches(Prisma.sql`x.value`, pattern)})`,
	translationMatches: (condition) => Prisma.sql`EXISTS (SELECT 1 FROM "Translation" x WHERE x."keyId" = k.id AND ${condition})`,
}

const UPDATED_WITHIN_INTERVAL: Record<TranslationsUpdatedWithin, string> = { DAY: '1 day', WEEK: '7 days', MONTH: '30 days' }

const orderBy = (sort: TranslationsSort, view: ViewSql): Prisma.Sql => {
	switch (sort) {
		case 'UNTRANSLATED_FIRST':
			return Prisma.sql`${view.untranslated} DESC, "group", k.name, k.id`
		case 'KEY':
			return Prisma.sql`k.namespace, "group", k.name, k.id`
		case 'UPDATED':
			return Prisma.sql`${view.updatedAt} DESC NULLS LAST, k.name, k.id`
	}
}

const toPlural = (pluralVariable: string | null): TranslationKeyPlural | null => (pluralVariable === null ? null : { variable: pluralVariable })

const toStatus = (value: string | null): TranslationStatus => (value === null ? 'UNTRANSLATED' : 'TRANSLATED')

const EMPTY_CELL: TranslationCell = { value: null, status: 'UNTRANSLATED', updatedAt: null, updatedBy: null }

const toItem = (row: ItemRow, languageIds: string[], cells: Map<string, CellRow>): TranslationListItem => ({
	keyId: row.keyId,
	namespace: row.namespace,
	name: row.name,
	group: row.group,
	description: row.description,
	plural: toPlural(row.pluralVariable),
	status: row.untranslated ? 'UNTRANSLATED' : 'TRANSLATED',
	translations: Object.fromEntries(
		languageIds.map((languageId) => {
			const cell = cells.get(`${row.keyId}:${languageId}`)
			return [
				languageId,
				cell
					? {
							value: cell.value,
							status: toStatus(cell.value),
							updatedAt: cell.updatedAt.toISOString(),
							updatedBy: cell.updatedBy && toEditor(cell.updatedBy),
						}
					: EMPTY_CELL,
			]
		}),
	),
})

const assertProjectLanguages = async (prisma: PrismaClient, projectId: string, languageIds: string[]) => {
	const ids = [...new Set(languageIds)]
	const found = await prisma.projectLanguage.count({ where: { projectId, id: { in: ids } } })
	if (found !== ids.length) {
		throw new AppError(404, ERROR_CODE.NOT_FOUND, 'Language not found')
	}
}

/**
 * Missing rows and `null` values are untranslated. With a source and target language the target decides the row status
 * (compact view), without them every language of the project does (extended view); see `translationsQuerySchema`. The
 * items carry a cell for every language either way. `stats`, `namespaces` and `editors` ignore the filters.
 */
export const listTranslations = async (prisma: PrismaClient, projectId: string, query: TranslationsQuery): Promise<TranslationsResponse> => {
	const { sourceLanguageId, targetLanguageId, search, status, namespace, updatedById, updatedWithin, sort, page, pageSize } = query
	if (sourceLanguageId !== undefined && targetLanguageId !== undefined) {
		await assertProjectLanguages(prisma, projectId, [sourceLanguageId, targetLanguageId])
	}
	const view = sourceLanguageId !== undefined && targetLanguageId !== undefined ? compactView(sourceLanguageId, targetLanguageId) : EXTENDED_VIEW

	const conditions = [Prisma.sql`k."projectId" = ${projectId}::uuid`]
	if (search !== undefined) {
		const pattern = toContainsPattern(search)
		conditions.push(Prisma.sql`(${matches(Prisma.sql`k.name`, pattern)} OR ${view.valueMatches(pattern)})`)
	}
	if (status !== undefined) {
		conditions.push(status === 'UNTRANSLATED' ? view.untranslated : Prisma.sql`NOT ${view.untranslated}`)
	}
	if (namespace !== undefined) {
		conditions.push(Prisma.sql`k.namespace = ${namespace}`)
	}
	if (updatedById !== undefined || updatedWithin !== undefined) {
		const updated = [
			...(updatedById === undefined ? [] : [Prisma.sql`x."updatedById" = ${updatedById}::uuid`]),
			...(updatedWithin === undefined ? [] : [Prisma.sql`x."updatedAt" >= now() - ${UPDATED_WITHIN_INTERVAL[updatedWithin]}::interval`]),
		]
		conditions.push(view.translationMatches(Prisma.join(updated, ' AND ')))
	}
	const from = Prisma.sql`"TranslationKey" k ${view.joins} WHERE ${Prisma.join(conditions, ' AND ')}`

	const [rows, [count], [stats], namespaces, languages, editors] = await Promise.all([
		prisma.$queryRaw<ItemRow[]>`
			SELECT k.id AS "keyId", k.namespace, k.name, ${GROUP_SQL} AS "group", k.description, k."pluralVariable", ${view.untranslated} AS untranslated
			FROM ${from}
			ORDER BY ${orderBy(sort, view)}
			LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
		prisma.$queryRaw<[{ total: number }]>`SELECT count(*)::int AS total FROM ${from}`,
		prisma.$queryRaw<[{ totalKeys: number; translated: number }]>`
			SELECT count(*)::int AS "totalKeys", (count(*) FILTER (WHERE NOT ${view.untranslated}))::int AS translated
			FROM "TranslationKey" k ${view.joins}
			WHERE k."projectId" = ${projectId}::uuid`,
		prisma.translationKey.findMany({ where: { projectId }, distinct: ['namespace'], select: { namespace: true }, orderBy: { namespace: 'asc' } }),
		prisma.projectLanguage.findMany({ where: { projectId }, select: { id: true } }),
		prisma.user.findMany({
			where: { translations: { some: { key: { projectId } } } },
			select: EDITOR_SELECT.select,
		}),
	])
	const cellRows = await prisma.translation.findMany({
		where: { keyId: { in: rows.map((row) => row.keyId) } },
		select: { keyId: true, languageId: true, value: true, updatedAt: true, updatedBy: EDITOR_SELECT },
	})
	const cells = new Map(cellRows.map((cell) => [`${cell.keyId}:${cell.languageId}`, cell]))
	const languageIds = languages.map((language) => language.id)

	return {
		items: rows.map((row) => toItem(row, languageIds, cells)),
		total: count.total,
		page,
		pageSize,
		stats: { totalKeys: stats.totalKeys, translated: stats.translated, untranslated: stats.totalKeys - stats.translated },
		namespaces: namespaces.map((row) => row.namespace),
		editors: editors.map(toEditor).sort((a, b) => a.name.localeCompare(b.name)),
	}
}

const keyNotFound = () => new AppError(404, ERROR_CODE.TRANSLATION_KEY_NOT_FOUND, 'Translation key not found')

/**
 * Upserts the target cell. On a plural key a non-null value must be a plural message with the key's variable. With
 * `protectVariables` a non-base value must keep the `{{…}}` placeholders of the base language value; when that is missing
 * or `null`, of the key name (a sentence key such as `Cena ({{symbol}})` names its variables), skipped when the name has none. No advisory lock: a concurrent import stays consistent, only its counts may be off by
 * this row (plan, "Odložené z míľnika A").
 */
export const updateTranslation = async (
	prisma: PrismaClient,
	{ projectId, keyId, languageId, userId }: { projectId: string; keyId: string; languageId: string; userId: string },
	value: string | null,
): Promise<UpdateTranslationResponse> => {
	const key = await prisma.translationKey.findFirst({
		where: { id: keyId, projectId },
		select: { name: true, pluralVariable: true, project: { select: { protectVariables: true } } },
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
		const reference = base?.value ?? (placeholders(key.name).size > 0 ? key.name : null)
		if (reference !== null) {
			const { missing, extra } = comparePlaceholders(placeholders(reference), value)
			if (missing.length > 0 || extra.length > 0) {
				throw new AppError(400, ERROR_CODE.PLACEHOLDER_MISMATCH, 'Placeholders differ from the base language', { missing, extra })
			}
		}
	}

	const row = await prisma.translation.upsert({
		where: { keyId_languageId: { keyId, languageId } },
		create: { keyId, languageId, value, updatedById: userId },
		update: { value, updatedById: userId },
		select: { value: true, updatedAt: true, updatedBy: EDITOR_SELECT },
	})
	return {
		value: row.value,
		status: row.value === null ? 'UNTRANSLATED' : 'TRANSLATED',
		updatedAt: row.updatedAt.toISOString(),
		updatedBy: row.updatedBy && toEditor(row.updatedBy),
	}
}

/**
 * Value of one language after the plural setting of its key changed. Plural on wraps the text as the `other` form
 * (a text that already is a plural message keeps its forms, also one wrapped in text, see `normalizePluralValue`); plural off keeps the `other` form; a new variable
 * re-serializes the forms. A value that is not a plural message stays as is.
 */
export const convertPluralValue = (value: string, from: string | null, to: string | null): string => {
	if (from === null) {
		return to === null ? value : serializePluralValue({ variable: to, forms: normalizePluralValue(value)?.forms ?? { other: value } })
	}
	const parsed = normalizePluralValue(value)
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
