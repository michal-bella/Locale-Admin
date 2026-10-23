import { type Writable } from 'node:stream'

import {
	comparePlaceholders,
	ERROR_CODE,
	EXPORT_ISSUES_MAX,
	type ExportCheckQuery,
	type ExportCheckResponse,
	type ExportIssue,
	type ExportQuery,
	type ExportStatus,
	type ExportWarning,
	placeholderReference,
} from '@locale/shared'

import { Prisma } from '../generated/prisma/client'
import { AppError } from '../lib/errors'
import { csvHeader, csvRow, csvSection, namespaceIssue, rowIssues, type ExportRow } from '../lib/export/csvWriter'
import { createXlsxWriter } from '../lib/export/xlsxWriter'
import { type PrismaClient } from '../lib/prisma'
import { assertProjectVersion, findPreviousVersion } from '../lib/projectVersions'

import { versionDiffSql } from './translations.service'

type Tx = Prisma.TransactionClient

type KeyRow = { id: string; namespace: string; name: string; pluralVariable: string | null }

/**
 * Where the file goes: `start` runs once the file is known to be valid, before anything is written. CSV goes through `write`,
 * XLSX is piped into `stream` by exceljs, so it waits for `drained` between batches instead.
 */
export type ExportSink = {
	start: () => void
	write: (chunk: string) => Promise<void>
	drained: () => Promise<void>
	stream: Writable
	signal: AbortSignal
}

type ExportContext = { tx: Tx; projectId: string; languageIds: string[]; tags: string[]; status: ExportStatus; version: Prisma.Sql; sink: ExportSink }

/** Keys read per query; one batch is the only part of the file held in memory. */
export const EXPORT_BATCH_SIZE = 1000

/** Same order as the Languages page: the base language first, then the drag and drop position. */
const LANGUAGE_ORDER = [{ isBase: 'desc' }, { position: 'asc' }, { tag: 'asc' }] satisfies Prisma.ProjectLanguageOrderByWithRelationInput[]

/** Prisma's transaction timer outlives the controller's export timeout, so a timed out export ends its callback before Prisma closes it. */
const TRANSACTION_TIMEOUT_MARGIN_MS = 5000

/** A key misses an exported language when its value is `null` (no row or a `null` value). */
const matchesStatus = (row: ExportRow, status: ExportStatus) => status === 'ALL' || row.values.includes(null) === (status === 'UNTRANSLATED')

/**
 * Keys in byte order of namespace and name (`COLLATE "C"`, the order of the i18nextJsonToCsv file), read with keyset
 * paging so memory does not grow with the project. The status is filtered here, after the batch is read: as an SQL
 * condition it would be evaluated for every remaining key of the project in every batch.
 */
async function* rowBatches(
	tx: Tx,
	projectId: string,
	languageIds: string[],
	status: ExportStatus,
	version: Prisma.Sql,
	baseLanguageId?: string,
): AsyncGenerator<ExportRow[]> {
	let last: KeyRow | undefined
	for (;;) {
		const after = last
			? Prisma.sql`AND (k.namespace COLLATE "C" > ${last.namespace} OR (k.namespace = ${last.namespace} AND k.name COLLATE "C" > ${last.name}))`
			: Prisma.empty
		const keys = await tx.$queryRaw<KeyRow[]>`
			SELECT k.id, k.namespace, k.name, k."pluralVariable"
			FROM "TranslationKey" k
			WHERE k."projectId" = ${projectId}::uuid ${version} ${after}
			ORDER BY k.namespace COLLATE "C", k.name COLLATE "C"
			LIMIT ${EXPORT_BATCH_SIZE}`
		if (keys.length === 0) {
			return
		}
		// The base language value is read too when the check needs it as the reference but the export leaves the base out.
		const readIds = baseLanguageId && !languageIds.includes(baseLanguageId) ? [...languageIds, baseLanguageId] : languageIds
		const translations = await tx.translation.findMany({
			where: { keyId: { in: keys.map((key) => key.id) }, languageId: { in: readIds }, value: { not: null } },
			select: { keyId: true, languageId: true, value: true },
		})
		const values = new Map(translations.map((translation) => [`${translation.keyId}:${translation.languageId}`, translation.value]))
		yield keys
			.map((key) => ({
				keyId: key.id,
				namespace: key.namespace,
				key: key.name,
				plural: key.pluralVariable !== null,
				values: languageIds.map((languageId) => values.get(`${key.id}:${languageId}`) ?? null),
				base: baseLanguageId === undefined ? null : (values.get(`${key.id}:${baseLanguageId}`) ?? null),
			}))
			.filter((row) => matchesStatus(row, status))
		if (keys.length < EXPORT_BATCH_SIZE) {
			return
		}
		last = keys.at(-1)
	}
}

/**
 * The CSV in two passes: the first only checks the values (422 `EXPORT_VALUE_UNSAFE` before anything is sent), the second
 * writes the file batch by batch. Returns the number of written keys.
 */
const writeCsv = async ({ tx, projectId, languageIds, tags, status, version, sink }: ExportContext): Promise<number> => {
	const issues: ExportIssue[] = []
	let total = 0
	let checkedNamespace = ''
	for await (const rows of rowBatches(tx, projectId, languageIds, status, version)) {
		if (sink.signal.aborted) {
			return 0
		}
		for (const row of rows) {
			const found = rowIssues(row, tags)
			if (row.namespace !== checkedNamespace) {
				checkedNamespace = row.namespace
				const namespace = namespaceIssue(row)
				if (namespace) {
					found.unshift(namespace)
				}
			}
			total += found.length
			issues.push(...found.slice(0, EXPORT_ISSUES_MAX - issues.length))
		}
	}
	if (total > 0) {
		throw new AppError(422, ERROR_CODE.EXPORT_VALUE_UNSAFE, 'Some values would break the CSV', { issues, total })
	}

	sink.start()
	await sink.write(csvHeader(tags))
	let namespace = ''
	let written = 0
	for await (const rows of rowBatches(tx, projectId, languageIds, status, version)) {
		if (sink.signal.aborted) {
			return written
		}
		let chunk = ''
		for (const row of rows) {
			if (row.namespace !== namespace) {
				namespace = row.namespace
				chunk += csvSection(namespace)
			}
			chunk += csvRow(row)
		}
		await sink.write(chunk)
		written += rows.length
	}
	return written
}

/** The XLSX in one pass: a cell holds `;`, line breaks and `--x--` without harm, so nothing is refused. */
const writeXlsx = async ({ tx, projectId, languageIds, tags, status, version, sink }: ExportContext): Promise<number> => {
	sink.start()
	const xlsx = createXlsxWriter(sink.stream, tags)
	let written = 0
	for await (const rows of rowBatches(tx, projectId, languageIds, status, version)) {
		if (sink.signal.aborted) {
			return written
		}
		xlsx.addRows(rows)
		written += rows.length
		await sink.drained()
	}
	await xlsx.finish()
	return written
}

/**
 * SQL limiting the keys to the exported version (every version holds its own copy); a foreign version is 404. With `diffOnly` only the keys
 * added or changed against the previous version (`versionDiffSql`), the whole version when it has no previous one.
 */
const versionCondition = async (prisma: PrismaClient, projectId: string, { versionId, diffOnly }: ExportCheckQuery): Promise<Prisma.Sql> => {
	await assertProjectVersion(prisma, projectId, versionId)
	if (!diffOnly) {
		return Prisma.sql`AND k."versionId" = ${versionId}::uuid`
	}
	const previous = await findPreviousVersion(prisma, versionId)
	return Prisma.sql`AND k."versionId" = ${versionId}::uuid AND ${versionDiffSql(previous?.id ?? null)}`
}

/**
 * Streams the project as CSV or XLSX into `sink`. One `REPEATABLE READ` transaction gives every read the same snapshot,
 * even while an import runs. Returns the number of written keys.
 */
export const exportTranslations = async (prisma: PrismaClient, projectId: string, query: ExportQuery, sink: ExportSink, timeoutMs: number): Promise<number> => {
	const languages = await prisma.projectLanguage.findMany({
		where: { projectId, id: { in: query.languageIds } },
		select: { id: true, tag: true },
		orderBy: LANGUAGE_ORDER,
	})
	if (languages.length !== query.languageIds.length) {
		throw new AppError(400, ERROR_CODE.EXPORT_LANGUAGES_INVALID, 'A language does not belong to the project')
	}
	const languageIds = languages.map((language) => language.id)
	const tags = languages.map((language) => language.tag)
	const version = await versionCondition(prisma, projectId, query)

	return prisma.$transaction(
		(tx) => {
			const context = { tx, projectId, languageIds, tags, status: query.status, version, sink }
			return query.format === 'XLSX' ? writeXlsx(context) : writeCsv(context)
		},
		{ isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: timeoutMs + TRANSACTION_TIMEOUT_MARGIN_MS },
	)
}

/**
 * Placeholder mismatches the planned export would carry: every exported value is compared with `placeholderReference` (a sentence key
 * with variables, else the base language value), as the edit and import checks do. The same keys as the export
 * (status over the exported languages); the base language is the reference even when it is not exported.
 */
export const checkExport = async (prisma: PrismaClient, projectId: string, query: ExportCheckQuery): Promise<ExportCheckResponse> => {
	const languages = await prisma.projectLanguage.findMany({
		where: { projectId, id: { in: query.languageIds } },
		select: { id: true, tag: true, isBase: true },
		orderBy: LANGUAGE_ORDER,
	})
	if (languages.length !== query.languageIds.length) {
		throw new AppError(400, ERROR_CODE.EXPORT_LANGUAGES_INVALID, 'A language does not belong to the project')
	}
	const base = await prisma.projectLanguage.findFirst({ where: { projectId, isBase: true }, select: { id: true } })
	const languageIds = languages.map((language) => language.id)
	const version = await versionCondition(prisma, projectId, query)

	return prisma.$transaction(
		async (tx) => {
			const warnings: ExportWarning[] = []
			let total = 0
			for await (const rows of rowBatches(tx, projectId, languageIds, query.status, version, base?.id)) {
				for (const row of rows) {
					languages.forEach((language, index) => {
						const value = row.values[index]
						const reference = placeholderReference({ name: row.key, plural: row.plural === true }, row.base ?? null, language.isBase)
						if (reference === null || value === null || value === undefined) {
							return
						}
						const { missing, extra } = comparePlaceholders(reference, value)
						if (missing.length === 0 && extra.length === 0) {
							return
						}
						total += 1
						if (warnings.length < EXPORT_ISSUES_MAX) {
							warnings.push({ keyId: row.keyId, namespace: row.namespace, key: row.key, languageTag: language.tag, missing, extra })
						}
					})
				}
			}
			return { warnings, total }
		},
		{ isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
	)
}
