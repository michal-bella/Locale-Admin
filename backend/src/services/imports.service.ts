import {
	ERROR_CODE,
	IMPORT_FILE_MAX_BYTES,
	IMPORT_WARNINGS_MAX,
	SUPPORTED_LANGUAGES,
	type ImportIssue,
	type ImportPreviewChanges,
	type ImportPreviewColumn,
	type ImportPreviewResponse,
	type ImportRequest,
	type ImportResult,
} from '@locale/shared'

import { type Prisma } from '../generated/prisma/client'
import { AppError } from '../lib/errors'
import { parseCsv } from '../lib/import/csvParser'
import { type ParsedFile } from '../lib/import/parsedFile'
import { comparePlaceholders, placeholders } from '../lib/placeholders'
import { type PrismaClient } from '../lib/prisma'

type KeyRow = { id: string; namespace: string; name: string; languageId: string | null; value: string | null }

type ProjectKey = { id: string; values: Map<string, string | null> }

/** What importing one value does. Shared by preview and import so their counts cannot diverge. */
type ValueChange = 'new' | 'changed' | 'unchanged' | 'keptBecauseNull'

const IMPORT_BATCH_SIZE = 5000

const CATALOG_TAGS = new Set(SUPPORTED_LANGUAGES.map(({ tag }) => tag.toLowerCase()))

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

/**
 * The file's keys in the project with their values by language id, by key identity. A key without translations has an empty map.
 * Not filtered by language: `languageId = ANY($1::uuid[])` as a parameter made Postgres pick a plan 100x slower.
 */
const loadProjectKeys = async (db: Prisma.TransactionClient, projectId: string, file: ParsedFile) => {
	const rows = await db.$queryRaw<KeyRow[]>`
		SELECT k.id, k.namespace, k.name, t."languageId", t.value
		FROM unnest(${file.rows.map((row) => row.namespace)}::text[], ${file.rows.map((row) => row.key)}::text[]) AS f(namespace, name)
		JOIN "TranslationKey" k ON k."projectId" = ${projectId}::uuid AND k.namespace = f.namespace AND k.name = f.name
		LEFT JOIN "Translation" t ON t."keyId" = k.id`
	const keys = new Map<string, ProjectKey>()
	for (const row of rows) {
		const identity = keyIdentity(row.namespace, row.name)
		const key = keys.get(identity) ?? { id: row.id, values: new Map<string, string | null>() }
		if (row.languageId !== null) {
			key.values.set(row.languageId, row.value)
		}
		keys.set(identity, key)
	}
	return keys
}

const classifyValue = (fileValue: string | null, dbValue: string | null): ValueChange => {
	if (fileValue === null) {
		return dbValue === null ? 'unchanged' : 'keptBecauseNull'
	}
	if (dbValue === null) {
		return 'new'
	}
	return fileValue === dbValue ? 'unchanged' : 'changed'
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
	const projectKeys = await loadProjectKeys(prisma, projectId, file)

	const namespaces = new Map<string, number>()
	let existingKeys = 0
	for (const row of file.rows) {
		namespaces.set(row.namespace, (namespaces.get(row.namespace) ?? 0) + 1)
		const projectKey = projectKeys.get(keyIdentity(row.namespace, row.key))
		if (projectKey) {
			existingKeys += 1
		}

		for (const { index, languageId, change } of projectColumns) {
			change[classifyValue(row.values[index] ?? null, projectKey?.values.get(languageId) ?? null)] += 1
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
			const { missing, extra } = comparePlaceholders(basePlaceholders, value)
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

type MappedColumn = { index: number; languageId: string }

/**
 * Every language column of the file must be listed exactly once, mapped languages must belong to the project and be
 * mapped once, and at least one column must be mapped. Returns the mapped columns with their position in `row.values`.
 */
const resolveColumns = (file: ParsedFile, columns: ImportRequest['columns'], projectLanguageIds: Set<string>): MappedColumn[] => {
	const invalid = (reason: string) => new AppError(400, ERROR_CODE.IMPORT_COLUMNS_INVALID, `Import columns are invalid: ${reason}`)
	const indexByColumn = new Map(file.columns.map(({ columnIndex }, index) => [columnIndex, index]))
	const listed = new Set<number>()
	const mappedLanguages = new Set<string>()
	const mapped: MappedColumn[] = []
	for (const { columnIndex, languageId } of columns) {
		const index = indexByColumn.get(columnIndex)
		if (index === undefined) {
			throw invalid(`column ${columnIndex} is not a language column of the file`)
		}
		if (listed.has(columnIndex)) {
			throw invalid(`column ${columnIndex} is listed twice`)
		}
		listed.add(columnIndex)
		if (languageId === null) {
			continue
		}
		if (!projectLanguageIds.has(languageId)) {
			throw invalid(`language ${languageId} is not a language of the project`)
		}
		if (mappedLanguages.has(languageId)) {
			throw invalid(`language ${languageId} is mapped twice`)
		}
		mappedLanguages.add(languageId)
		mapped.push({ index, languageId })
	}
	if (listed.size !== file.columns.length) {
		throw invalid('a language column of the file is missing')
	}
	if (mapped.length === 0) {
		throw invalid('every column is skipped')
	}
	return mapped
}

const batches = <T>(items: T[]): T[][] =>
	Array.from({ length: Math.ceil(items.length / IMPORT_BATCH_SIZE) }, (_, index) => items.slice(index * IMPORT_BATCH_SIZE, (index + 1) * IMPORT_BATCH_SIZE))

/**
 * Writes the file into the project in one transaction. An advisory lock per project serializes concurrent imports, so the
 * pre-read of current values decides exactly what is written and the counts equal the preview's `new` and `changed`.
 * A `null` in the file never writes; an equal value is not touched, so `updatedAt` and `updatedById` keep their values.
 */
export const importFile = (prisma: PrismaClient, projectId: string, userId: string, file: ParsedFile, request: ImportRequest): Promise<ImportResult> =>
	prisma.$transaction(
		async (tx) => {
			// Below the 60 s transaction timeout, so an import waiting behind another one fails cleanly (500) instead of hanging.
			await tx.$executeRaw`SET LOCAL lock_timeout = '30s'`
			// One bigint key per project; the `import:` prefix keeps it apart from other advisory locks. A hash collision only serializes two projects.
			await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`import:${projectId}`}, 0))`

			const languages = await tx.projectLanguage.findMany({ where: { projectId }, select: { id: true } })
			const columns = resolveColumns(file, request.columns, new Set(languages.map(({ id }) => id)))
			const projectKeys = await loadProjectKeys(tx, projectId, file)

			const missingKeys = request.createMissingKeys ? file.rows.filter((row) => !projectKeys.has(keyIdentity(row.namespace, row.key))) : []
			const createdKeyIds = new Map<string, string>()
			for (const batch of batches(missingKeys)) {
				const created = await tx.$queryRaw<{ id: string; namespace: string; name: string }[]>`
					INSERT INTO "TranslationKey" (id, "projectId", namespace, name, "createdAt", "updatedAt")
					SELECT gen_random_uuid(), ${projectId}::uuid, f.namespace, f.name, now(), now()
					FROM unnest(${batch.map((row) => row.namespace)}::text[], ${batch.map((row) => row.key)}::text[]) AS f(namespace, name)
					ON CONFLICT ("projectId", namespace, name) DO NOTHING
					RETURNING id, namespace, name`
				for (const key of created) {
					createdKeyIds.set(keyIdentity(key.namespace, key.name), key.id)
				}
			}

			const writes: { keyId: string; languageId: string; value: string }[] = []
			let translationsCreated = 0
			let translationsUpdated = 0
			for (const row of file.rows) {
				const identity = keyIdentity(row.namespace, row.key)
				const projectKey = projectKeys.get(identity)
				const keyId = projectKey?.id ?? createdKeyIds.get(identity)
				if (keyId === undefined) {
					continue
				}
				for (const { index, languageId } of columns) {
					const value = row.values[index] ?? null
					const change = classifyValue(value, projectKey?.values.get(languageId) ?? null)
					if (value === null || (change !== 'new' && change !== 'changed')) {
						continue
					}
					if (change === 'new') {
						translationsCreated += 1
					} else {
						translationsUpdated += 1
					}
					writes.push({ keyId, languageId, value })
				}
			}

			for (const batch of batches(writes)) {
				await tx.$executeRaw`
					INSERT INTO "Translation" ("keyId", "languageId", value, "updatedById", "updatedAt")
					SELECT f."keyId", f."languageId", f.value, ${userId}::uuid, now()
					FROM unnest(${batch.map((write) => write.keyId)}::uuid[], ${batch.map((write) => write.languageId)}::uuid[], ${batch.map((write) => write.value)}::text[])
						AS f("keyId", "languageId", value)
					ON CONFLICT ("keyId", "languageId") DO UPDATE
					SET value = EXCLUDED.value, "updatedById" = EXCLUDED."updatedById", "updatedAt" = EXCLUDED."updatedAt"
					WHERE "Translation".value IS DISTINCT FROM EXCLUDED.value`
			}

			return {
				keysCreated: createdKeyIds.size,
				translationsCreated,
				translationsUpdated,
				skippedColumns: request.columns.filter(({ languageId }) => languageId === null).length,
			}
		},
		// The timeout includes waiting for the lock while another import of the project runs.
		{ maxWait: 10_000, timeout: 60_000 },
	)
