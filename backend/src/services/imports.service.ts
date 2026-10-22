import { randomUUID } from 'node:crypto'

import {
	ACTIVITY_TYPE,
	ERROR_CODE,
	IMPORT_FILE_MAX_BYTES,
	IMPORT_REMOVED_NAMES_MAX,
	IMPORT_WARNINGS_MAX,
	SUPPORTED_LANGUAGES,
	detectPluralVariable,
	normalizePluralValue,
	serializePluralValue,
	type ImportIssue,
	type ImportPreviewChanges,
	type ImportPreviewColumn,
	type ImportPreviewResponse,
	type ImportRequest,
	type ImportResult,
	type ROLE,
	comparePlaceholders,
} from '@locale/shared'

import { type Prisma } from '../generated/prisma/client'
import { recordActivity } from '../lib/activity'
import { AppError } from '../lib/errors'
import { parseCsv } from '../lib/import/csvParser'
import { type ParsedFile } from '../lib/import/parsedFile'
import { recomputePlaceholderWarnings } from '../lib/placeholderWarnings'
import { type PrismaClient } from '../lib/prisma'
import { assertProjectVersion, findPreviousVersion, resolveVersion } from '../lib/projectVersions'

type KeyRow = { id: string; namespace: string; name: string; pluralVariable: string | null; languageId: string | null; value: string | null }

/** A key the file matches: one of the version, or one of the previous version the import copies first (`id` then becomes the copy's). */
type ProjectKey = { id: string; pluralVariable: string | null; values: Map<string, string | null>; fromPrevious: boolean }

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
 * The file's keys in the version with their values by language id, by key identity. A key without translations has an empty map.
 * Not filtered by language: `languageId = ANY($1::uuid[])` as a parameter made Postgres pick a plan 100x slower.
 */
const loadVersionKeys = async (db: Prisma.TransactionClient, versionId: string, file: ParsedFile) => {
	const rows = await db.$queryRaw<KeyRow[]>`
		SELECT k.id, k.namespace, k.name, k."pluralVariable", t."languageId", t.value
		FROM unnest(${file.rows.map((row) => row.namespace)}::text[], ${file.rows.map((row) => row.key)}::text[]) AS f(namespace, name)
		JOIN "TranslationKey" k ON k."versionId" = ${versionId}::uuid AND k.namespace = f.namespace AND k.name = f.name
		LEFT JOIN "Translation" t ON t."keyId" = k.id`
	const keys = new Map<string, ProjectKey>()
	for (const row of rows) {
		const identity = keyIdentity(row.namespace, row.name)
		const key = keys.get(identity) ?? { id: row.id, pluralVariable: row.pluralVariable, values: new Map<string, string | null>(), fromPrevious: false }
		if (row.languageId !== null) {
			key.values.set(row.languageId, row.value)
		}
		keys.set(identity, key)
	}
	return keys
}

/**
 * The file's keys as the import sees them: the version's own keys, and for the rest the previous version's (marked `fromPrevious`), which the
 * import copies with every language before it writes the file's values over them.
 */
const loadKeysForImport = async (db: Prisma.TransactionClient, versionId: string, previousVersionId: string | null, file: ParsedFile) => {
	const keys = await loadVersionKeys(db, versionId, file)
	if (previousVersionId === null) {
		return keys
	}
	for (const [identity, key] of await loadVersionKeys(db, previousVersionId, file)) {
		if (!keys.has(identity)) {
			keys.set(identity, { ...key, fromPrevious: true })
		}
	}
	return keys
}

/** Keys of the version the file does not mention: the file defines the key set, so the import removes them. */
const loadRemovedKeys = async (db: Prisma.TransactionClient, versionId: string, file: ParsedFile) => {
	const inFile = new Set(file.rows.map((row) => keyIdentity(row.namespace, row.key)))
	const keys = await db.translationKey.findMany({
		where: { versionId },
		select: { id: true, namespace: true, name: true },
		orderBy: [{ namespace: 'asc' }, { name: 'asc' }],
	})
	return keys.filter((key) => !inFile.has(keyIdentity(key.namespace, key.name)))
}

type FileRow = ParsedFile['rows'][number]

type MappedColumn = { index: number; languageId: string }

/** The key's plural variable after the import: its own, else the one detected from its values with the filled file values on top. */
const pluralAfterImport = (projectKey: ProjectKey | undefined, row: FileRow, columns: MappedColumn[]): string | null => {
	if (projectKey?.pluralVariable != null) {
		return projectKey.pluralVariable
	}
	const values = new Map(projectKey?.values)
	for (const { index, languageId } of columns) {
		const value = row.values[index] ?? null
		if (value !== null) {
			values.set(languageId, value)
		}
	}
	return detectPluralVariable(values.values())
}

/** What the import stores for a plural key: a plural message wrapped in text becomes a plain one, the text going into every form. */
const valueToWrite = (value: string | null, pluralVariable: string | null): string | null => {
	if (value === null || pluralVariable === null) {
		return value
	}
	const normalized = normalizePluralValue(value)
	return normalized?.variable === pluralVariable ? serializePluralValue(normalized) : value
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

/** Compares a parsed file with the keys of the version without writing anything. Tags match case-insensitively, the response keeps the file's spelling. */
export const previewImport = async (prisma: PrismaClient, projectId: string, versionId: string, file: ParsedFile): Promise<ImportPreviewResponse> => {
	await assertProjectVersion(prisma, projectId, versionId)
	const previousVersion = await findPreviousVersion(prisma, versionId)
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
	const projectKeys = await loadKeysForImport(prisma, versionId, previousVersion?.id ?? null, file)
	const removed = await loadRemovedKeys(prisma, versionId, file)

	const namespaces = new Map<string, number>()
	let existingKeys = 0
	let copiedKeys = 0
	for (const row of file.rows) {
		namespaces.set(row.namespace, (namespaces.get(row.namespace) ?? 0) + 1)
		const projectKey = projectKeys.get(keyIdentity(row.namespace, row.key))
		if (projectKey?.fromPrevious) {
			copiedKeys += 1
		} else if (projectKey) {
			existingKeys += 1
		}

		const pluralVariable = pluralAfterImport(projectKey, row, projectColumns)
		for (const { index, languageId, change } of projectColumns) {
			change[classifyValue(valueToWrite(row.values[index] ?? null, pluralVariable), projectKey?.values.get(languageId) ?? null)] += 1
		}

		const baseValue = baseIndex === -1 ? null : (row.values[baseIndex] ?? null)
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
			if (value === null || baseValue === null) {
				return
			}
			const { missing, extra } = comparePlaceholders(baseValue, value)
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
		keys: { total: file.rows.length, new: file.rows.length - existingKeys - copiedKeys, existing: existingKeys, copiedFromPrevious: copiedKeys },
		namespaces: [...namespaces].map(([namespace, keys]) => ({ namespace, keys })),
		changes: projectColumns.map(({ change }): ImportPreviewChanges => change),
		warnings: warnings.slice(0, IMPORT_WARNINGS_MAX),
		warningsTotal: warnings.length,
		previousVersion,
		removed: {
			total: removed.length,
			names: removed.slice(0, IMPORT_REMOVED_NAMES_MAX).map((key) => (key.namespace ? `${key.namespace}:${key.name}` : key.name)),
		},
	}
}

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
 * A key whose values (the stored ones with the filled file values on top) are ICU plural messages with one variable becomes plural
 * (`detectPluralVariable`): a new key, or an existing one without a plural setting; an existing plural variable is never changed. For a
 * plural key a message with text around the plural is written as a plain plural message (`valueToWrite`), and the preview counts the same.
 * An import that creates a key or writes a value records one `KEYS_IMPORTED` event whose `count` is the number of written values.
 * The file goes into `request.versionId` and defines its key set: a key the version already has is updated, a key only the previous version
 * (nearest older by `startsAt`) has is copied with every language first, a key in neither is created (`createMissingKeys`), and a key of the
 * version missing from the file is removed with its cells. A locked version is refused for anyone but an ADMIN; the version remembers the
 * import in `importedAt`.
 */
export const importFile = (
	prisma: PrismaClient,
	{ projectId, userId, role }: { projectId: string; userId: string; role: ROLE },
	file: ParsedFile,
	request: ImportRequest,
): Promise<ImportResult> =>
	prisma.$transaction(
		async (tx) => {
			// Below the 60 s transaction timeout, so an import waiting behind another one fails cleanly (500) instead of hanging.
			await tx.$executeRaw`SET LOCAL lock_timeout = '30s'`
			// One bigint key per project; the `import:` prefix keeps it apart from other advisory locks. A hash collision only serializes two projects.
			await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`import:${projectId}`}, 0))`
			// Not Postgres now(): Prisma's @updatedAt uses the Node clock, the DB clock (Docker VM) can lag it by a few ms,
			// and now() is the transaction start, before the lock wait. Mixing them made `updatedAt` go backwards.
			const writtenAt = new Date()
			const version = await resolveVersion(tx, { projectId, versionId: request.versionId, role })
			const versionId = version.id

			const languages = await tx.projectLanguage.findMany({
				where: { projectId },
				select: { id: true, tag: true },
				orderBy: [{ isBase: 'desc' }, { position: 'asc' }, { tag: 'asc' }],
			})
			const columns = resolveColumns(file, request.columns, new Set(languages.map(({ id }) => id)))
			const previousVersion = await findPreviousVersion(tx, versionId)
			const projectKeys = await loadKeysForImport(tx, versionId, previousVersion?.id ?? null, file)

			// Copies of the previous version's keys, cells included (who wrote them and when stays, as the version's history), then the
			// file's values go over them like over the version's own keys.
			const copied = [...projectKeys.values()].filter((key) => key.fromPrevious).map((key) => ({ key, newId: randomUUID() }))
			for (const batch of batches(copied)) {
				await tx.$executeRaw`
					INSERT INTO "TranslationKey" (id, "projectId", "versionId", namespace, name, description, "pluralVariable", "createdAt", "updatedAt")
					SELECT m."newId", k."projectId", ${versionId}::uuid, k.namespace, k.name, k.description, k."pluralVariable", ${writtenAt}, ${writtenAt}
					FROM unnest(${batch.map(({ key }) => key.id)}::uuid[], ${batch.map(({ newId }) => newId)}::uuid[]) AS m("oldId", "newId")
					JOIN "TranslationKey" k ON k.id = m."oldId"`
				await tx.$executeRaw`
					INSERT INTO "Translation" ("keyId", "languageId", value, "updatedById", "updatedAt", "placeholderWarning")
					SELECT m."newId", t."languageId", t.value, t."updatedById", t."updatedAt", t."placeholderWarning"
					FROM unnest(${batch.map(({ key }) => key.id)}::uuid[], ${batch.map(({ newId }) => newId)}::uuid[]) AS m("oldId", "newId")
					JOIN "Translation" t ON t."keyId" = m."oldId"`
				for (const { key, newId } of batch) {
					key.id = newId
				}
			}

			const missingKeys = request.createMissingKeys ? file.rows.filter((row) => !projectKeys.has(keyIdentity(row.namespace, row.key))) : []
			const createdKeyIds = new Map<string, string>()
			for (const batch of batches(missingKeys)) {
				const created = await tx.$queryRaw<{ id: string; namespace: string; name: string }[]>`
					INSERT INTO "TranslationKey" (id, "projectId", namespace, name, "pluralVariable", "versionId", "createdAt", "updatedAt")
					SELECT gen_random_uuid(), ${projectId}::uuid, f.namespace, f.name, f.plural, ${versionId}::uuid, ${writtenAt}, ${writtenAt}
					FROM unnest(${batch.map((row) => row.namespace)}::text[], ${batch.map((row) => row.key)}::text[], ${batch.map((row) => pluralAfterImport(undefined, row, columns))}::text[])
						AS f(namespace, name, plural)
					ON CONFLICT ("versionId", namespace, name) DO NOTHING
					RETURNING id, namespace, name`
				for (const key of created) {
					createdKeyIds.set(keyIdentity(key.namespace, key.name), key.id)
				}
			}

			const madePlural = file.rows.flatMap((row) => {
				const projectKey = projectKeys.get(keyIdentity(row.namespace, row.key))
				const variable = projectKey && projectKey.pluralVariable === null ? pluralAfterImport(projectKey, row, columns) : null
				return projectKey && variable !== null ? [{ keyId: projectKey.id, variable }] : []
			})
			for (const batch of batches(madePlural)) {
				await tx.$executeRaw`
					UPDATE "TranslationKey" k SET "pluralVariable" = f.variable, "updatedAt" = ${writtenAt}
					FROM unnest(${batch.map((key) => key.keyId)}::uuid[], ${batch.map((key) => key.variable)}::text[]) AS f(id, variable)
					WHERE k.id = f.id AND k."pluralVariable" IS NULL`
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
				const pluralVariable = pluralAfterImport(projectKey, row, columns)
				for (const { index, languageId } of columns) {
					const value = valueToWrite(row.values[index] ?? null, pluralVariable)
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
					SELECT f."keyId", f."languageId", f.value, ${userId}::uuid, ${writtenAt}
					FROM unnest(${batch.map((write) => write.keyId)}::uuid[], ${batch.map((write) => write.languageId)}::uuid[], ${batch.map((write) => write.value)}::text[])
						AS f("keyId", "languageId", value)
					ON CONFLICT ("keyId", "languageId") DO UPDATE
					SET value = EXCLUDED.value, "updatedById" = EXCLUDED."updatedById", "updatedAt" = EXCLUDED."updatedAt"
					WHERE "Translation".value IS DISTINCT FROM EXCLUDED.value`
			}

			const removed = await loadRemovedKeys(tx, versionId, file)
			for (const batch of batches(removed)) {
				await tx.translationKey.deleteMany({ where: { id: { in: batch.map((key) => key.id) } } })
			}

			await recomputePlaceholderWarnings(tx, [...createdKeyIds.values(), ...writes.map(({ keyId }) => keyId)])
			await tx.projectVersion.update({ where: { id: versionId }, data: { importedAt: writtenAt } })

			if (createdKeyIds.size > 0 || copied.length > 0 || removed.length > 0 || writes.length > 0) {
				const writtenLanguageIds = new Set(writes.map(({ languageId }) => languageId))
				await recordActivity(tx, {
					projectId,
					userId,
					versionId,
					type: ACTIVITY_TYPE.KEYS_IMPORTED,
					count: writes.length,
					payload: {
						keysCreated: createdKeyIds.size,
						keysCopied: copied.length,
						keysRemoved: removed.length,
						translationsCreated,
						translationsUpdated,
						languageTags: languages.filter(({ id }) => writtenLanguageIds.has(id)).map(({ tag }) => tag),
						versionName: version.name,
					},
				})
			}

			return {
				keysCreated: createdKeyIds.size,
				keysCopied: copied.length,
				keysRemoved: removed.length,
				translationsCreated,
				translationsUpdated,
				skippedColumns: request.columns.filter(({ languageId }) => languageId === null).length,
				version: { id: version.id, name: version.name },
			}
		},
		// The timeout includes waiting for the lock while another import of the project runs.
		{ maxWait: 10_000, timeout: 60_000 },
	)
