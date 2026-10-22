import {
	ACTIVITY_TYPE,
	type ActivityVersionField,
	type CreateProjectVersionRequest,
	ERROR_CODE,
	type ProjectVersion,
	type ProjectVersionsResponse,
	type UpdateProjectVersionRequest,
	VALIDATION_CODE,
	type VersionDiffSummary,
	type VERSION_LOCK,
	getVersionState,
	isVersionLocked,
} from '@locale/shared'

import { Prisma } from '../generated/prisma/client'
import { recordActivity } from '../lib/activity'
import { AppError } from '../lib/errors'
import { type PrismaClient } from '../lib/prisma'
import {
	assertProjectVersion,
	findCurrentVersionId,
	findPreviousVersion,
	fromDbDate,
	toDbDate,
	todayVersionDate,
	versionNotFound,
} from '../lib/projectVersions'

import { isPrismaError } from './projects.service'
import { EDITOR_SELECT, toEditor, versionDiffSql } from './translations.service'

const VERSION_SELECT = {
	id: true,
	name: true,
	startsAt: true,
	endsAt: true,
	lock: true,
	importedAt: true,
	createdAt: true,
	createdBy: EDITOR_SELECT,
	_count: { select: { keys: true } },
} satisfies Prisma.ProjectVersionSelect

type VersionRow = Prisma.ProjectVersionGetPayload<{ select: typeof VERSION_SELECT }>

/** Newest window first; two versions starting the same day keep creation order. */
const VERSION_ORDER = [{ startsAt: 'desc' }, { createdAt: 'desc' }] satisfies Prisma.ProjectVersionOrderByWithRelationInput[]

const toProjectVersion = (row: VersionRow, today: string, currentId: string | null): ProjectVersion => {
	const dates = { startsAt: fromDbDate(row.startsAt), endsAt: fromDbDate(row.endsAt), lock: row.lock as VERSION_LOCK }
	return {
		id: row.id,
		name: row.name,
		...dates,
		isLocked: isVersionLocked(dates, today),
		state: getVersionState(dates, today),
		isCurrent: row.id === currentId,
		importedAt: row.importedAt?.toISOString() ?? null,
		keyCount: row._count.keys,
		createdAt: row.createdAt.toISOString(),
		createdBy: row.createdBy && toEditor(row.createdBy),
	}
}

const nameTaken = () => new AppError(409, ERROR_CODE.PROJECT_VERSION_NAME_TAKEN, 'Version name is already taken in this project')

const endsNotAfterStarts = () =>
	new AppError(400, ERROR_CODE.VALIDATION_ERROR, 'endsAt must be after startsAt', [{ path: 'endsAt', code: VALIDATION_CODE.INVALID }])

export const listProjectVersions = async (prisma: PrismaClient, projectId: string): Promise<ProjectVersionsResponse> => {
	const today = todayVersionDate()
	const [rows, currentId] = await Promise.all([
		prisma.projectVersion.findMany({ where: { projectId }, select: VERSION_SELECT, orderBy: VERSION_ORDER }),
		findCurrentVersionId(prisma, projectId, today),
	])
	return { items: rows.map((row) => toProjectVersion(row, today, currentId)) }
}

/** No pre-check for the name: the unique constraint (P2002) also covers concurrent requests. */
export const createProjectVersion = async (
	prisma: PrismaClient,
	{ projectId, userId }: { projectId: string; userId: string },
	{ name, startsAt, endsAt }: CreateProjectVersionRequest,
): Promise<ProjectVersion> => {
	try {
		return await prisma.$transaction(async (tx) => {
			const row = await tx.projectVersion.create({
				data: { projectId, name, startsAt: toDbDate(startsAt), endsAt: toDbDate(endsAt), createdById: userId },
				select: VERSION_SELECT,
			})
			await recordActivity(tx, { projectId, userId, versionId: row.id, type: ACTIVITY_TYPE.VERSION_CREATED, payload: { name, startsAt, endsAt } })
			const today = todayVersionDate()
			return toProjectVersion(row, today, await findCurrentVersionId(tx, projectId, today))
		})
	} catch (err) {
		if (isPrismaError(err, 'P2002')) {
			throw nameTaken()
		}
		throw err
	}
}

/**
 * Changes the name, the dates or the lock of a version; the dates are checked together with the stored ones (`endsAt > startsAt`).
 * Keys and cells keep pointing at the version. Writes `VERSION_UPDATED` with the fields that really changed, nothing when none did.
 */
export const updateProjectVersion = async (
	prisma: PrismaClient,
	{ projectId, userId }: { projectId: string; userId: string },
	versionId: string,
	input: UpdateProjectVersionRequest,
): Promise<ProjectVersion> => {
	try {
		return await prisma.$transaction(async (tx) => {
			const current = await tx.projectVersion.findFirst({ where: { id: versionId, projectId }, select: VERSION_SELECT })
			if (!current) {
				throw versionNotFound()
			}
			const next = {
				name: input.name ?? current.name,
				startsAt: input.startsAt ?? fromDbDate(current.startsAt),
				endsAt: input.endsAt ?? fromDbDate(current.endsAt),
				lock: input.lock ?? (current.lock as VERSION_LOCK),
			}
			if (next.endsAt <= next.startsAt) {
				throw endsNotAfterStarts()
			}
			const before = {
				name: current.name,
				startsAt: fromDbDate(current.startsAt),
				endsAt: fromDbDate(current.endsAt),
				lock: current.lock as VERSION_LOCK,
			}
			const fields = (Object.keys(next) as ActivityVersionField[]).filter((field) => next[field] !== before[field])
			const today = todayVersionDate()
			if (fields.length === 0) {
				return toProjectVersion(current, today, await findCurrentVersionId(tx, projectId, today))
			}
			const row = await tx.projectVersion.update({
				where: { id: versionId },
				data: { name: next.name, startsAt: toDbDate(next.startsAt), endsAt: toDbDate(next.endsAt), lock: next.lock },
				select: VERSION_SELECT,
			})
			await recordActivity(tx, { projectId, userId, versionId, type: ACTIVITY_TYPE.VERSION_UPDATED, payload: { name: next.name, fields } })
			return toProjectVersion(row, today, await findCurrentVersionId(tx, projectId, today))
		})
	} catch (err) {
		if (isPrismaError(err, 'P2002')) {
			throw nameTaken()
		}
		throw err
	}
}

/** How the version differs from the previous one: keys added, keys changed (`versionDiffSql`) and keys the previous version has that this one lost. */
export const getVersionDiffSummary = async (prisma: PrismaClient, projectId: string, versionId: string): Promise<VersionDiffSummary> => {
	await assertProjectVersion(prisma, projectId, versionId)
	const previous = await findPreviousVersion(prisma, versionId)
	if (!previous) {
		return { previousVersion: null, added: await prisma.translationKey.count({ where: { versionId } }), changed: 0, removed: 0 }
	}
	const sameKey = (other: string) =>
		Prisma.sql`EXISTS (SELECT 1 FROM "TranslationKey" o WHERE o."versionId" = ${other}::uuid AND o.namespace = k.namespace AND o.name = k.name)`
	const [[counts], [lost]] = await Promise.all([
		prisma.$queryRaw<[{ added: number; changed: number }]>`
			SELECT (count(*) FILTER (WHERE NOT ${sameKey(previous.id)}))::int AS added,
				(count(*) FILTER (WHERE ${sameKey(previous.id)} AND ${versionDiffSql(previous.id)}))::int AS changed
			FROM "TranslationKey" k WHERE k."versionId" = ${versionId}::uuid`,
		prisma.$queryRaw<[{ removed: number }]>`
			SELECT count(*)::int AS removed FROM "TranslationKey" k WHERE k."versionId" = ${previous.id}::uuid AND NOT ${sameKey(versionId)}`,
	])
	return { previousVersion: previous, added: counts.added, changed: counts.changed, removed: lost.removed }
}

/**
 * Deletes a version with its keys and cells (cascade); the current version (today in its window) is refused with 409
 * `PROJECT_VERSION_CURRENT`. Writes `VERSION_DELETED` with the key count; earlier events of the version keep their payload and lose the link.
 */
export const deleteProjectVersion = async (
	prisma: PrismaClient,
	{ projectId, userId }: { projectId: string; userId: string },
	versionId: string,
): Promise<void> =>
	prisma.$transaction(async (tx) => {
		const version = await tx.projectVersion.findFirst({
			where: { id: versionId, projectId },
			select: { id: true, name: true, _count: { select: { keys: true } } },
		})
		if (!version) {
			throw versionNotFound()
		}
		if ((await findCurrentVersionId(tx, projectId, todayVersionDate())) === versionId) {
			throw new AppError(409, ERROR_CODE.PROJECT_VERSION_CURRENT, 'The current version cannot be deleted')
		}
		await tx.projectVersion.delete({ where: { id: versionId } })
		await recordActivity(tx, { projectId, userId, type: ACTIVITY_TYPE.VERSION_DELETED, payload: { name: version.name, keyCount: version._count.keys } })
	})
