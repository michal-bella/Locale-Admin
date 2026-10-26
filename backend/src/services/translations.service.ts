import {
	ACTIVITY_KEY_FIELDS,
	ACTIVITY_TYPE,
	type CreateTranslationKeyRequest,
	type CreateTranslationKeyResponse,
	canManageProject,
	ERROR_CODE,
	type ProjectAccessRole,
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
	comparePlaceholders,
	placeholderReference,
} from '@locale/shared'

import { Prisma, type Translation } from '../generated/prisma/client'
import { recordActivity } from '../lib/activity'
import { AppError } from '../lib/errors'
import { recomputePlaceholderWarnings } from '../lib/placeholderWarnings'
import { type PrismaClient } from '../lib/prisma'
import { assertProjectVersion, findPreviousVersion, resolveVersion } from '../lib/projectVersions'

import { isPrismaError } from './projects.service'

type ItemRow = {
	keyId: string
	namespace: string
	name: string
	group: string
	description: string | null
	pluralVariable: string | null
	untranslated: boolean
	/** Only when the version has a previous one: see `diffColumnsSql`. */
	added?: boolean
	changedLanguageIds?: string[]
	previousValues?: Record<string, string | null>
}

export type EditorRow = { id: string; email: string; firstName: string | null; lastName: string | null }

type CellRow = Pick<Translation, 'keyId' | 'languageId' | 'value' | 'updatedAt'> & { updatedBy: EditorRow | null }

export const EDITOR_SELECT = { select: { id: true, email: true, firstName: true, lastName: true } } as const

export const toEditor = ({ id, email, firstName, lastName }: EditorRow): TranslationEditor => ({
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

/** A key with a cell whose placeholders differ from the base language (`Translation.placeholderWarning`, see lib/placeholderWarnings). */
const HAS_WARNING_SQL = Prisma.sql`EXISTS (SELECT 1 FROM "Translation" w WHERE w."keyId" = k.id AND w."placeholderWarning")`

/**
 * Keys of the listed version (`k`) that differ from the previous version `previousVersionId`: added (no key with the same namespace and name
 * there) or changed (another description or plural variable, or a value that differs in any language of the project, a missing row counting
 * as `null`). Without a previous version every key is added.
 */
export const versionDiffSql = (previousVersionId: string | null): Prisma.Sql => {
	if (previousVersionId === null) {
		return Prisma.sql`TRUE`
	}
	const previousKey = Prisma.sql`"TranslationKey" p WHERE p."versionId" = ${previousVersionId}::uuid AND p.namespace = k.namespace AND p.name = k.name`
	return Prisma.sql`(NOT EXISTS (SELECT 1 FROM ${previousKey}) OR EXISTS (
		SELECT 1 FROM ${previousKey} AND (
			p.description IS DISTINCT FROM k.description OR p."pluralVariable" IS DISTINCT FROM k."pluralVariable" OR EXISTS (
				SELECT 1 FROM "ProjectLanguage" l
				LEFT JOIN "Translation" a ON a."keyId" = k.id AND a."languageId" = l.id
				LEFT JOIN "Translation" b ON b."keyId" = p.id AND b."languageId" = l.id
				WHERE l."projectId" = k."projectId" AND a.value IS DISTINCT FROM b.value))))`
}

/**
 * `added`, `changedLanguageIds` and `previousValues` (the values of those languages in the previous version) of a key `k` against the
 * previous version. The first version has none, so its keys carry no diff.
 */
const diffColumnsSql = (previousVersionId: string): Prisma.Sql => {
	const previousKey = Prisma.sql`SELECT p.id FROM "TranslationKey" p WHERE p."versionId" = ${previousVersionId}::uuid AND p.namespace = k.namespace AND p.name = k.name`
	const changedCells = Prisma.sql`FROM "ProjectLanguage" l
		LEFT JOIN "Translation" a ON a."keyId" = k.id AND a."languageId" = l.id
		LEFT JOIN "Translation" b ON b."keyId" = (${previousKey}) AND b."languageId" = l.id
		WHERE l."projectId" = k."projectId" AND EXISTS (${previousKey}) AND a.value IS DISTINCT FROM b.value`
	return Prisma.sql`NOT EXISTS (${previousKey}) AS added,
		ARRAY(SELECT l.id ${changedCells} ORDER BY l.position, l.tag) AS "changedLanguageIds",
		(SELECT COALESCE(jsonb_object_agg(l.id, b.value), '{}'::jsonb) ${changedCells}) AS "previousValues"`
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
	...(row.added === undefined
		? {}
		: { diff: { added: row.added, changedLanguageIds: row.changedLanguageIds ?? [], previousValues: row.previousValues ?? {} } }),
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
 * The keys of one version (every version holds its own copy, see `ProjectVersion`); a version of another project is 404.
 * Missing rows and `null` values are untranslated. With a source and target language the target decides the row status
 * (compact view), without them every language of the project does (extended view); see `translationsQuerySchema`. The
 * items carry a cell for every language either way. `stats`, `namespaces` and `editors` are the version's, ignoring the filters.
 */
export const listTranslations = async (prisma: PrismaClient, projectId: string, query: TranslationsQuery): Promise<TranslationsResponse> => {
	const { sourceLanguageId, targetLanguageId, search, status, namespace, updatedById, updatedWithin, warnings, versionId, diff, sort, page, pageSize } = query
	await assertProjectVersion(prisma, projectId, versionId)
	const previousVersionId = (await findPreviousVersion(prisma, versionId))?.id ?? null
	if (sourceLanguageId !== undefined && targetLanguageId !== undefined) {
		await assertProjectLanguages(prisma, projectId, [sourceLanguageId, targetLanguageId])
	}
	const view = sourceLanguageId !== undefined && targetLanguageId !== undefined ? compactView(sourceLanguageId, targetLanguageId) : EXTENDED_VIEW

	const conditions = [Prisma.sql`k."versionId" = ${versionId}::uuid`]
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
	if (warnings) {
		conditions.push(HAS_WARNING_SQL)
	}
	if (diff) {
		conditions.push(versionDiffSql(previousVersionId))
	}
	if (updatedById !== undefined || updatedWithin !== undefined) {
		const updated = [
			...(updatedById === undefined ? [] : [Prisma.sql`x."updatedById" = ${updatedById}::uuid`]),
			...(updatedWithin === undefined ? [] : [Prisma.sql`x."updatedAt" >= now() - ${UPDATED_WITHIN_INTERVAL[updatedWithin]}::interval`]),
		]
		conditions.push(view.translationMatches(Prisma.join(updated, ' AND ')))
	}
	const from = Prisma.sql`"TranslationKey" k ${view.joins} WHERE ${Prisma.join(conditions, ' AND ')}`

	const [rows, [count], [stats], namespaces, languages, editors, translatedByLanguage] = await Promise.all([
		prisma.$queryRaw<ItemRow[]>`
			SELECT k.id AS "keyId", k.namespace, k.name, ${GROUP_SQL} AS "group", k.description, k."pluralVariable", ${view.untranslated} AS untranslated
				${previousVersionId === null ? Prisma.empty : Prisma.sql`, ${diffColumnsSql(previousVersionId)}`}
			FROM ${from}
			ORDER BY ${orderBy(sort, view)}
			LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
		prisma.$queryRaw<[{ total: number }]>`SELECT count(*)::int AS total FROM ${from}`,
		prisma.$queryRaw<[{ totalKeys: number; translated: number; warnings: number }]>`
			SELECT count(*)::int AS "totalKeys", (count(*) FILTER (WHERE NOT ${view.untranslated}))::int AS translated,
				(count(*) FILTER (WHERE ${HAS_WARNING_SQL}))::int AS warnings
			FROM "TranslationKey" k ${view.joins}
			WHERE k."versionId" = ${versionId}::uuid`,
		prisma.translationKey.findMany({ where: { versionId }, distinct: ['namespace'], select: { namespace: true }, orderBy: { namespace: 'asc' } }),
		prisma.projectLanguage.findMany({ where: { projectId }, select: { id: true } }),
		prisma.$queryRaw<(EditorRow & { edits: number })[]>`
			WITH edits AS (
				SELECT t."updatedById" AS id, count(*)::int AS edits
				FROM "Translation" t JOIN "TranslationKey" k ON k.id = t."keyId"
				WHERE k."versionId" = ${versionId}::uuid AND t."updatedById" IS NOT NULL
				GROUP BY t."updatedById"
			)
			SELECT u.id, u.email, u."firstName", u."lastName", COALESCE(e.edits, 0) AS edits
			FROM "User" u LEFT JOIN edits e ON e.id = u.id
			WHERE e.id IS NOT NULL OR (u.role <> 'ADMIN' AND u.id IN (SELECT "userId" FROM "ProjectMember" WHERE "projectId" = ${projectId}::uuid))`,
		prisma.$queryRaw<{ languageId: string; translated: number }[]>`
			SELECT t."languageId", count(*)::int AS translated
			FROM "Translation" t JOIN "TranslationKey" k ON k.id = t."keyId"
			WHERE k."versionId" = ${versionId}::uuid AND t.value IS NOT NULL
			GROUP BY t."languageId"`,
	])
	const cellRows = await prisma.translation.findMany({
		where: { keyId: { in: rows.map((row) => row.keyId) } },
		select: { keyId: true, languageId: true, value: true, updatedAt: true, updatedBy: EDITOR_SELECT },
	})
	const cells = new Map(cellRows.map((cell) => [`${cell.keyId}:${cell.languageId}`, cell]))
	const languageIds = languages.map((language) => language.id)
	const translatedIn = new Map(translatedByLanguage.map((row) => [row.languageId, row.translated]))

	return {
		items: rows.map((row) => toItem(row, languageIds, cells)),
		total: count.total,
		page,
		pageSize,
		stats: {
			totalKeys: stats.totalKeys,
			translated: stats.translated,
			untranslated: stats.totalKeys - stats.translated,
			warnings: stats.warnings,
			untranslatedByLanguage: Object.fromEntries(languageIds.map((id) => [id, stats.totalKeys - (translatedIn.get(id) ?? 0)])),
		},
		namespaces: namespaces.map((row) => row.namespace),
		editors: editors
			.map((row) => ({ ...toEditor(row), edits: row.edits }))
			.sort((a, b) => b.edits - a.edits || a.name.localeCompare(b.name))
			.map(({ id, name }) => ({ id, name })),
	}
}

const keyNotFound = () => new AppError(404, ERROR_CODE.TRANSLATION_KEY_NOT_FOUND, 'Translation key not found')

/**
 * Upserts the target cell. On a plural key a non-null value must be a plural message with the key's variable. With
 * `protectVariables` a non-base value must keep the `{{…}}` placeholders of the base language value; when that is missing
 * or `null`, of the key name (a sentence key such as `Cena ({{symbol}})` names its variables), skipped when the name has none. Writes `TRANSLATION_UPDATED` only when the stored value changes.
 * The cell belongs to the key's version: an EDITOR cannot write into a locked one (409 `PROJECT_VERSION_LOCKED`).
 */
export const updateTranslation = async (
	prisma: PrismaClient,
	{ projectId, keyId, languageId, userId, role }: { projectId: string; keyId: string; languageId: string; userId: string; role: ProjectAccessRole },
	{ value }: { value: string | null },
): Promise<UpdateTranslationResponse> => {
	const key = await prisma.translationKey.findFirst({
		where: { id: keyId, projectId },
		select: { namespace: true, name: true, pluralVariable: true, versionId: true, project: { select: { protectVariables: true } } },
	})
	if (!key) {
		throw keyNotFound()
	}
	const language = await prisma.projectLanguage.findFirst({ where: { id: languageId, projectId }, select: { tag: true, isBase: true } })
	if (!language) {
		throw new AppError(404, ERROR_CODE.NOT_FOUND, 'Language not found')
	}

	if (value !== null && key.pluralVariable !== null && parsePluralValue(value)?.variable !== key.pluralVariable) {
		throw new AppError(400, ERROR_CODE.VALIDATION_ERROR, 'Value of a plural key must be a plural message with the key variable', [
			{ path: 'value', code: VALIDATION_CODE.INVALID },
		])
	}

	if (value !== null && key.project.protectVariables) {
		const base = language.isBase
			? null
			: await prisma.translation.findFirst({ where: { keyId, language: { projectId, isBase: true } }, select: { value: true } })
		const reference = placeholderReference({ name: key.name, plural: key.pluralVariable !== null }, base?.value ?? null, language.isBase)
		if (reference !== null) {
			const { missing, extra } = comparePlaceholders(reference, value)
			if (missing.length > 0 || extra.length > 0) {
				throw new AppError(400, ERROR_CODE.PLACEHOLDER_MISMATCH, 'Placeholders differ from the base language', { missing, extra })
			}
		}
	}

	const row = await prisma.$transaction(async (tx) => {
		// Without these locks a concurrent import or edit could replace the cell between the read and the upsert, and the
		// event would record the wrong old value or none. The shared lock only waits for a running import.
		await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(hashtextextended(${`import:${projectId}`}, 0))`
		await tx.$queryRaw`SELECT id FROM "TranslationKey" WHERE id = ${keyId}::uuid FOR NO KEY UPDATE`
		const oldValue = (await tx.translation.findUnique({ where: { keyId_languageId: { keyId, languageId } }, select: { value: true } }))?.value ?? null
		await resolveVersion(tx, { projectId, versionId: key.versionId, role })
		const updated = await tx.translation.upsert({
			where: { keyId_languageId: { keyId, languageId } },
			create: { keyId, languageId, value, updatedById: userId },
			update: { value, updatedById: userId },
			select: { value: true, updatedAt: true, updatedBy: EDITOR_SELECT },
		})
		if (updated.value !== oldValue) {
			await recordActivity(tx, {
				projectId,
				userId,
				versionId: key.versionId,
				type: ACTIVITY_TYPE.TRANSLATION_UPDATED,
				payload: { keyId, namespace: key.namespace, name: key.name, languageTag: language.tag, oldValue, newValue: updated.value },
			})
		}
		await recomputePlaceholderWarnings(tx, [keyId])
		return updated
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
 * transaction and marks the converted rows as updated by the acting user. Writes `KEY_UPDATED` with the attributes that really changed.
 * An EDITOR may change only the description (403 `FORBIDDEN` for a name or plural field) and not in a locked version (409 `PROJECT_VERSION_LOCKED`).
 */
export const updateTranslationKey = async (
	prisma: PrismaClient,
	{ projectId, keyId, userId, role }: { projectId: string; keyId: string; userId: string; role: ProjectAccessRole },
	{ name, description, plural }: UpdateTranslationKeyRequest,
): Promise<UpdateTranslationKeyResponse> =>
	prisma.$transaction(async (tx) => {
		if (!canManageProject(role) && (name !== undefined || plural !== undefined)) {
			throw new AppError(403, ERROR_CODE.FORBIDDEN, 'Only an admin or a manager can rename a key or change its plural forms')
		}
		const key = await tx.translationKey.findFirst({
			where: { id: keyId, projectId },
			select: { name: true, description: true, pluralVariable: true, versionId: true },
		})
		if (!key) {
			throw keyNotFound()
		}
		await resolveVersion(tx, { projectId, versionId: key.versionId, role })
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
		const fields = ACTIVITY_KEY_FIELDS.filter((field) => updated[field] !== key[field])
		if (updated.name !== key.name || pluralVariable !== key.pluralVariable) {
			await recomputePlaceholderWarnings(tx, [keyId])
		}
		if (fields.length > 0) {
			await recordActivity(tx, {
				projectId,
				userId,
				versionId: key.versionId,
				type: ACTIVITY_TYPE.KEY_UPDATED,
				payload: { keyId, namespace: updated.namespace, name: updated.name, fields },
			})
		}
		return {
			keyId: updated.id,
			namespace: updated.namespace,
			name: updated.name,
			group: translationGroup(updated.namespace, updated.name),
			description: updated.description,
			plural: toPlural(updated.pluralVariable),
		}
	})

/**
 * Adds a key by hand into a namespace the version already has, with the given values (empty ones stay untranslated, no row).
 * With variable protection on, every non-base value must keep the placeholders of the base value (or of a key name with
 * placeholders when the base is empty). Writes `KEY_CREATED` with the languages that got a value.
 */
export const createTranslationKey = async (
	prisma: PrismaClient,
	{ projectId, userId, role }: { projectId: string; userId: string; role: ProjectAccessRole },
	{ namespace, name, translations, versionId }: CreateTranslationKeyRequest,
): Promise<CreateTranslationKeyResponse> => {
	const project = await prisma.project.findUniqueOrThrow({
		where: { id: projectId },
		select: { protectVariables: true, languages: { select: { id: true, tag: true, isBase: true }, orderBy: { position: 'asc' } } },
	})
	const unknown = Object.keys(translations).filter((languageId) => !project.languages.some((language) => language.id === languageId))
	if (unknown.length > 0) {
		throw new AppError(
			400,
			ERROR_CODE.VALIDATION_ERROR,
			'Language not found in the project',
			unknown.map((languageId) => ({ path: `translations.${languageId}`, code: VALIDATION_CODE.INVALID })),
		)
	}
	const values = project.languages.flatMap((language) => {
		const value = translations[language.id] ?? null
		return value === null ? [] : [{ ...language, value }]
	})

	if (project.protectVariables) {
		const baseValue = values.find((language) => language.isBase)?.value ?? null
		const mismatch = (reference: string, language: (typeof values)[number]) => {
			const { missing, extra } = comparePlaceholders(reference, language.value)
			if (missing.length > 0 || extra.length > 0) {
				throw new AppError(400, ERROR_CODE.PLACEHOLDER_MISMATCH, 'Placeholders differ from the base language', {
					missing,
					extra,
					languageId: language.id,
				})
			}
		}
		for (const language of values) {
			const reference = placeholderReference({ name, plural: false }, baseValue, language.isBase)
			if (reference !== null) {
				mismatch(reference, language)
			}
		}
	}

	return prisma.$transaction(async (tx) => {
		// Waits for a running import, like a cell edit, so the import never meets a key created in the middle of it.
		await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(hashtextextended(${`import:${projectId}`}, 0))`
		const version = await resolveVersion(tx, { projectId, versionId, role })
		// A version gets its keys from an import; a key by hand only joins them.
		if (version.importedAt === null) {
			throw new AppError(409, ERROR_CODE.PROJECT_VERSION_EMPTY, 'Version has no import yet')
		}
		if (!(await tx.translationKey.findFirst({ where: { versionId, namespace }, select: { id: true } }))) {
			throw new AppError(400, ERROR_CODE.VALIDATION_ERROR, 'Namespace not found in the version', [{ path: 'namespace', code: VALIDATION_CODE.INVALID }])
		}
		const key = await tx.translationKey
			.create({
				data: {
					projectId,
					versionId,
					namespace,
					name,
					translations: { create: values.map(({ id, value }) => ({ languageId: id, value, updatedById: userId })) },
				},
				select: { id: true, namespace: true, name: true, description: true, pluralVariable: true },
			})
			.catch((err: unknown) => {
				if (isPrismaError(err, 'P2002')) {
					throw new AppError(409, ERROR_CODE.TRANSLATION_KEY_TAKEN, 'Translation key name is already taken in this namespace')
				}
				throw err
			})
		await recomputePlaceholderWarnings(tx, [key.id])
		await recordActivity(tx, {
			projectId,
			userId,
			versionId,
			type: ACTIVITY_TYPE.KEY_CREATED,
			payload: { keyId: key.id, namespace: key.namespace, name: key.name, languageTags: values.map((language) => language.tag) },
		})
		return {
			keyId: key.id,
			namespace: key.namespace,
			name: key.name,
			group: translationGroup(key.namespace, key.name),
			description: key.description,
			plural: toPlural(key.pluralVariable),
		}
	})
}
