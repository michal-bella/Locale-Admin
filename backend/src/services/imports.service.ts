import {
	ERROR_CODE,
	IMPORT_FILE_MAX_BYTES,
	IMPORT_WARNINGS_MAX,
	SUPPORTED_LANGUAGES,
	type ImportIssue,
	type ImportPreviewChanges,
	type ImportPreviewColumn,
	type ImportPreviewResponse,
} from '@locale/shared'

import { AppError } from '../lib/errors'
import { parseCsv } from '../lib/import/csvParser'
import { type ParsedFile } from '../lib/import/parsedFile'
import { type PrismaClient } from '../lib/prisma'

type KeyRow = { namespace: string; name: string; languageId: string | null; value: string | null }

const CATALOG_TAGS = new Set(SUPPORTED_LANGUAGES.map(({ tag }) => tag.toLowerCase()))

const PLACEHOLDER_PATTERN = /\{\{(.*?)\}\}/g

const keyIdentity = (namespace: string, name: string) => `${namespace}\u0000${name}`

/** Runs before the zod schema so an oversized file gets its own code. A non-string `content` is left to the schema. */
export const assertImportFileSize = (body: unknown): void => {
	const content: unknown = typeof body === 'object' && body !== null && 'content' in body ? body.content : undefined
	if (typeof content === 'string' && Buffer.byteLength(content, 'utf8') > IMPORT_FILE_MAX_BYTES) {
		throw new AppError(413, ERROR_CODE.IMPORT_FILE_TOO_LARGE, 'Import file is too large')
	}
}

export const parseImportFile = (content: string): ParsedFile => {
	const result = parseCsv(content)
	if (!result.ok) {
		throw new AppError(422, ERROR_CODE.IMPORT_FILE_INVALID, 'Import file is invalid', { issues: result.issues, total: result.total })
	}
	return result.file
}

/** `{{ count }}` and `{{count}}` are the same placeholder; the set keeps the order of first appearance. */
const placeholders = (value: string): Set<string> =>
	new Set([...value.matchAll(PLACEHOLDER_PATTERN)].map((match) => `{{${(match[1] ?? '').replace(/\s+/g, '')}}}`))

const difference = (a: Set<string>, b: Set<string>) => [...a].filter((item) => !b.has(item))

/**
 * Values of the file's keys in the project, by key identity and language id. A key without translations maps to an empty map.
 * Not filtered by language: `languageId = ANY($1::uuid[])` as a parameter made Postgres pick a plan 100x slower.
 */
const loadProjectValues = async (prisma: PrismaClient, projectId: string, file: ParsedFile) => {
	const rows = await prisma.$queryRaw<KeyRow[]>`
		SELECT k.namespace, k.name, t."languageId", t.value
		FROM unnest(${file.rows.map((row) => row.namespace)}::text[], ${file.rows.map((row) => row.key)}::text[]) AS f(namespace, name)
		JOIN "TranslationKey" k ON k."projectId" = ${projectId}::uuid AND k.namespace = f.namespace AND k.name = f.name
		LEFT JOIN "Translation" t ON t."keyId" = k.id`
	const values = new Map<string, Map<string, string | null>>()
	for (const row of rows) {
		const identity = keyIdentity(row.namespace, row.name)
		const byLanguage = values.get(identity) ?? new Map<string, string | null>()
		if (row.languageId !== null) {
			byLanguage.set(row.languageId, row.value)
		}
		values.set(identity, byLanguage)
	}
	return values
}

/** Compares a parsed file with the project without writing anything. Tags match case-insensitively, the response keeps the file's spelling. */
export const previewImport = async (prisma: PrismaClient, projectId: string, file: ParsedFile): Promise<ImportPreviewResponse> => {
	const languages = await prisma.projectLanguage.findMany({ where: { projectId }, select: { id: true, tag: true, isBase: true } })
	const languageByTag = new Map(languages.map((language) => [language.tag.toLowerCase(), language]))

	const warnings: ImportIssue[] = []
	const columns: ImportPreviewColumn[] = file.columns.map(({ tag, columnIndex }) => {
		const language = languageByTag.get(tag.toLowerCase())
		const stats = { translations: 0, untranslated: 0, warnings: 0 }
		if (language) {
			return { tag, columnIndex, match: 'PROJECT', languageId: language.id, stats }
		}
		const inCatalog = CATALOG_TAGS.has(tag.toLowerCase())
		warnings.push({ code: inCatalog ? 'LANGUAGE_NOT_IN_PROJECT' : 'LANGUAGE_UNKNOWN', line: file.headerLine, column: columnIndex, params: { tag } })
		return { tag, columnIndex, match: inCatalog ? 'CATALOG' : 'UNKNOWN', stats }
	})
	const baseLanguageId = languages.find((language) => language.isBase)?.id
	const baseIndex = baseLanguageId === undefined ? -1 : columns.findIndex((column) => column.languageId === baseLanguageId)

	const projectColumns = columns.flatMap((column, index) =>
		column.languageId === undefined
			? []
			: [
					{
						index,
						languageId: column.languageId,
						change: { tag: column.tag, columnIndex: column.columnIndex, new: 0, changed: 0, unchanged: 0, keptBecauseNull: 0 },
					},
				],
	)
	const projectValues = await loadProjectValues(prisma, projectId, file)

	const namespaces = new Map<string, number>()
	let existingKeys = 0
	for (const row of file.rows) {
		namespaces.set(row.namespace, (namespaces.get(row.namespace) ?? 0) + 1)
		const dbValues = projectValues.get(keyIdentity(row.namespace, row.key))
		if (dbValues) {
			existingKeys += 1
		}

		for (const { index, languageId, change } of projectColumns) {
			const fileValue = row.values[index] ?? null
			const dbValue = dbValues?.get(languageId) ?? null
			if (fileValue === null) {
				change[dbValue === null ? 'unchanged' : 'keptBecauseNull'] += 1
			} else if (dbValue === null) {
				change.new += 1
			} else {
				change[fileValue === dbValue ? 'unchanged' : 'changed'] += 1
			}
		}

		const baseValue = baseIndex === -1 ? null : (row.values[baseIndex] ?? null)
		const basePlaceholders = baseValue === null ? undefined : placeholders(baseValue)
		columns.forEach((column, index) => {
			const value = row.values[index] ?? null
			column.stats[value === null ? 'untranslated' : 'translations'] += 1
			const position = { line: row.line, column: column.columnIndex }
			if (index === baseIndex) {
				if (value === null) {
					column.stats.warnings += 1
					warnings.push({ code: 'BASE_LANGUAGE_UNTRANSLATED', ...position, params: { tag: column.tag, key: row.key, namespace: row.namespace } })
				}
				return
			}
			if (value === null || basePlaceholders === undefined) {
				return
			}
			const own = placeholders(value)
			const missing = difference(basePlaceholders, own)
			const extra = difference(own, basePlaceholders)
			if (missing.length > 0 || extra.length > 0) {
				column.stats.warnings += 1
				warnings.push({
					code: 'PLACEHOLDER_MISMATCH',
					...position,
					params: { tag: column.tag, key: row.key, namespace: row.namespace, missing: missing.join(', '), extra: extra.join(', ') },
				})
			}
		})
	}

	return {
		columns,
		keys: { total: file.rows.length, new: file.rows.length - existingKeys, existing: existingKeys },
		namespaces: [...namespaces].map(([namespace, keys]) => ({ namespace, keys })),
		changes: projectColumns.map(({ change }): ImportPreviewChanges => change),
		warnings: warnings.slice(0, IMPORT_WARNINGS_MAX),
		warningsTotal: warnings.length,
	}
}
