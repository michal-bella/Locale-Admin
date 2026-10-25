import { canManageProject, ERROR_CODE, type ROLE, type VERSION_LOCK, isVersionLocked, toVersionDate } from '@locale/shared'

import { type Prisma } from '../generated/prisma/client'
import { type PrismaClient } from '../lib/prisma'

import { AppError } from './errors'

/** Today as `YYYY-MM-DD` in the server's calendar; versions have no time of day, so a few hours of zone difference do not matter. */
export const todayVersionDate = (): string => toVersionDate(new Date())

/** A `@db.Date` column comes back as UTC midnight, so the day is read in UTC (local getters would shift it west of Greenwich). */
export const fromDbDate = (date: Date): string => date.toISOString().slice(0, 10)

/** `YYYY-MM-DD` → the UTC midnight Prisma stores in a `@db.Date` column. */
export const toDbDate = (date: string): Date => new Date(`${date}T00:00:00.000Z`)

export const versionNotFound = () => new AppError(404, ERROR_CODE.PROJECT_VERSION_NOT_FOUND, 'Version not found in the project')

/** The version today falls into, the latest `startsAt` (then the newest) when several overlap; `null` when none. */
export const findCurrentVersionId = async (db: PrismaClient | Prisma.TransactionClient, projectId: string, today: string): Promise<string | null> =>
	(
		await db.projectVersion.findFirst({
			where: { projectId, startsAt: { lte: toDbDate(today) }, endsAt: { gte: toDbDate(today) } },
			orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
			select: { id: true },
		})
	)?.id ?? null

/**
 * The version a project-level view shows: the current one by date, else the newest `startsAt` (a project between windows or with only
 * upcoming versions), `null` without versions. The project list and the Languages page count the keys of this version.
 */
export const findDefaultVersionId = async (db: PrismaClient | Prisma.TransactionClient, projectId: string, today: string): Promise<string | null> =>
	(await findCurrentVersionId(db, projectId, today)) ??
	(await db.projectVersion.findFirst({ where: { projectId }, orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }], select: { id: true } }))?.id ??
	null

export type ResolvedVersion = { id: string; name: string; importedAt: Date | null }

/**
 * The nearest older version of the same project by `startsAt` (then by creation), whose keys an import copies and a diff compares with;
 * `null` for the first version. An older version without an import counts as one without keys.
 */
export const findPreviousVersion = async (db: PrismaClient | Prisma.TransactionClient, versionId: string): Promise<{ id: string; name: string } | null> => {
	const version = await db.projectVersion.findUniqueOrThrow({ where: { id: versionId }, select: { projectId: true, startsAt: true, createdAt: true } })
	return db.projectVersion.findFirst({
		where: {
			projectId: version.projectId,
			id: { not: versionId },
			OR: [{ startsAt: { lt: version.startsAt } }, { startsAt: version.startsAt, createdAt: { lt: version.createdAt } }],
		},
		orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
		select: { id: true, name: true },
	})
}

/** A version of the project for a read (list, export): 404 `PROJECT_VERSION_NOT_FOUND` when it belongs to another project or does not exist. */
export const assertProjectVersion = async (db: PrismaClient | Prisma.TransactionClient, projectId: string, versionId: string): Promise<ResolvedVersion> => {
	const version = await db.projectVersion.findFirst({ where: { id: versionId, projectId }, select: { id: true, name: true, importedAt: true } })
	if (!version) {
		throw versionNotFound()
	}
	return version
}

/**
 * The version a write goes into: a version of the project (404 `PROJECT_VERSION_NOT_FOUND`) that, for anyone but an ADMIN or a MANAGER, is not
 * locked (409 `PROJECT_VERSION_LOCKED`): locked by hand, or `AUTO` outside its `startsAt`–`endsAt` window (`isVersionLocked`).
 */
export const resolveVersion = async (
	db: PrismaClient | Prisma.TransactionClient,
	{ projectId, versionId, role }: { projectId: string; versionId: string; role: ROLE },
): Promise<ResolvedVersion> => {
	const version = await db.projectVersion.findFirst({
		where: { id: versionId, projectId },
		select: { id: true, name: true, importedAt: true, lock: true, startsAt: true, endsAt: true },
	})
	if (!version) {
		throw versionNotFound()
	}
	const dates = { lock: version.lock as VERSION_LOCK, startsAt: fromDbDate(version.startsAt), endsAt: fromDbDate(version.endsAt) }
	if (!canManageProject(role) && isVersionLocked(dates, todayVersionDate())) {
		throw new AppError(409, ERROR_CODE.PROJECT_VERSION_LOCKED, 'Version is locked')
	}
	return { id: version.id, name: version.name, importedAt: version.importedAt }
}
