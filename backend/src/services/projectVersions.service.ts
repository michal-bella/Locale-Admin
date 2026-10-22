import {
	ACTIVITY_TYPE,
	type ActivityVersionField,
	type CreateProjectVersionRequest,
	ERROR_CODE,
	type ProjectVersion,
	type ProjectVersionsResponse,
	type UpdateProjectVersionRequest,
	VALIDATION_CODE,
	type VERSION_LOCK,
	getVersionState,
	isVersionLocked,
} from '@locale/shared'

import { type Prisma } from '../generated/prisma/client'
import { recordActivity } from '../lib/activity'
import { AppError } from '../lib/errors'
import { type PrismaClient } from '../lib/prisma'
import { findCurrentVersionId, fromDbDate, toDbDate, todayVersionDate, versionNotFound } from '../lib/projectVersions'

import { isPrismaError } from './projects.service'
import { EDITOR_SELECT, toEditor } from './translations.service'

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
			await recordActivity(tx, { projectId, userId, type: ACTIVITY_TYPE.VERSION_CREATED, payload: { name, startsAt, endsAt } })
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
			await recordActivity(tx, { projectId, userId, type: ACTIVITY_TYPE.VERSION_UPDATED, payload: { name: next.name, fields } })
			return toProjectVersion(row, today, await findCurrentVersionId(tx, projectId, today))
		})
	} catch (err) {
		if (isPrismaError(err, 'P2002')) {
			throw nameTaken()
		}
		throw err
	}
}
