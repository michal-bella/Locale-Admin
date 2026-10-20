import { ERROR_CODE, EXPORT_ISSUES_MAX, type ExportIssue, type ExportQuery, type ExportStatus } from '@locale/shared'

import { Prisma } from '../generated/prisma/client'
import { AppError } from '../lib/errors'
import { csvHeader, csvRow, csvSection, rowIssues, type ExportRow } from '../lib/export/csvWriter'
import { type PrismaClient } from '../lib/prisma'

type Tx = Prisma.TransactionClient

type KeyRow = { id: string; namespace: string; name: string }

/** Where the CSV goes: `start` runs once the file is known to be valid, right before the first `write`. */
export type ExportSink = { start: () => void; write: (chunk: string) => Promise<void>; signal: AbortSignal }

/** Keys read per query; one batch is the only part of the file held in memory. */
export const EXPORT_BATCH_SIZE = 1000

/** Same order as the Languages page: the base language first, then the drag and drop position. */
const LANGUAGE_ORDER = [{ isBase: 'desc' }, { position: 'asc' }, { tag: 'asc' }] satisfies Prisma.ProjectLanguageOrderByWithRelationInput[]

/** A key misses an exported language when it has no row or a `null` value for it. */
const statusCondition = (status: ExportStatus, languageIds: string[]): Prisma.Sql => {
	if (status === 'ALL') {
		return Prisma.empty
	}
	const missing = Prisma.sql`EXISTS (
		SELECT 1 FROM unnest(${languageIds}::uuid[]) AS l(id)
		WHERE NOT EXISTS (SELECT 1 FROM "Translation" x WHERE x."keyId" = k.id AND x."languageId" = l.id AND x.value IS NOT NULL))`
	return status === 'UNTRANSLATED' ? Prisma.sql`AND ${missing}` : Prisma.sql`AND NOT ${missing}`
}

/**
 * Keys in byte order of namespace and name (`COLLATE "C"`, the order of the i18nextJsonToCsv file), read with keyset
 * paging so memory does not grow with the project.
 */
async function* rowBatches(tx: Tx, projectId: string, languageIds: string[], status: ExportStatus): AsyncGenerator<ExportRow[]> {
	let last: KeyRow | undefined
	for (;;) {
		const after = last
			? Prisma.sql`AND (k.namespace COLLATE "C" > ${last.namespace} OR (k.namespace = ${last.namespace} AND k.name COLLATE "C" > ${last.name}))`
			: Prisma.empty
		const keys = await tx.$queryRaw<KeyRow[]>`
			SELECT k.id, k.namespace, k.name
			FROM "TranslationKey" k
			WHERE k."projectId" = ${projectId}::uuid ${statusCondition(status, languageIds)} ${after}
			ORDER BY k.namespace COLLATE "C", k.name COLLATE "C"
			LIMIT ${EXPORT_BATCH_SIZE}`
		if (keys.length === 0) {
			return
		}
		const translations = await tx.translation.findMany({
			where: { keyId: { in: keys.map((key) => key.id) }, languageId: { in: languageIds }, value: { not: null } },
			select: { keyId: true, languageId: true, value: true },
		})
		const values = new Map(translations.map((translation) => [`${translation.keyId}:${translation.languageId}`, translation.value]))
		yield keys.map((key) => ({
			keyId: key.id,
			namespace: key.namespace,
			key: key.name,
			values: languageIds.map((languageId) => values.get(`${key.id}:${languageId}`) ?? null),
		}))
		if (keys.length < EXPORT_BATCH_SIZE) {
			return
		}
		last = keys.at(-1)
	}
}

/**
 * Streams the project as CSV into `sink`. One `REPEATABLE READ` transaction makes both passes see the same snapshot,
 * even while an import runs: the first pass only checks the values (422 `EXPORT_VALUE_UNSAFE` before anything is sent),
 * the second writes the file batch by batch.
 */
export const exportCsv = async (prisma: PrismaClient, projectId: string, query: ExportQuery, sink: ExportSink, timeoutMs: number): Promise<void> => {
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

	await prisma.$transaction(
		async (tx) => {
			const issues: ExportIssue[] = []
			let total = 0
			for await (const rows of rowBatches(tx, projectId, languageIds, query.status)) {
				for (const row of rows) {
					const found = rowIssues(row, tags)
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
			for await (const rows of rowBatches(tx, projectId, languageIds, query.status)) {
				if (sink.signal.aborted) {
					return
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
			}
		},
		{ isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: timeoutMs },
	)
}
