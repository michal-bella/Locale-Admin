import { ERROR_CODE, ROLE, type VERSION_LOCK, isVersionLocked, toVersionDate } from '@locale/shared'

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
 * The version a write goes into. `undefined` picks the current version (`findCurrentVersionId`) or `null` when there is none; an id
 * must be a version of the project (404 `PROJECT_VERSION_NOT_FOUND`) and, for anyone but an ADMIN, not locked (409 `PROJECT_VERSION_LOCKED`).
 * A version that is current by its dates can only be locked by hand.
 */
export const resolveVersionId = async (
	db: PrismaClient | Prisma.TransactionClient,
	{ projectId, versionId, role }: { projectId: string; versionId: string | undefined; role: ROLE },
): Promise<string | null> => {
	const today = todayVersionDate()
	const id = versionId ?? (await findCurrentVersionId(db, projectId, today))
	if (id === null) {
		return null
	}
	const version = await db.projectVersion.findFirst({ where: { id, projectId }, select: { lock: true, endsAt: true } })
	if (!version) {
		throw versionNotFound()
	}
	if (role !== ROLE.ADMIN && isVersionLocked({ lock: version.lock as VERSION_LOCK, endsAt: fromDbDate(version.endsAt) }, today)) {
		throw new AppError(409, ERROR_CODE.PROJECT_VERSION_LOCKED, 'Version is locked')
	}
	return id
}
