import {
	ACTIVITY_CONTRIBUTORS_MAX,
	ACTIVITY_RANGE_DAYS,
	ERROR_CODE,
	VALIDATION_CODE,
	activityEventDataSchema,
	type ActivityDailyQuery,
	type ActivityDailyResponse,
	type ActivityListQuery,
	type ActivityListResponse,
} from '@locale/shared'

import { Prisma } from '../generated/prisma/client'
import { AppError } from '../lib/errors'
import { type PrismaClient } from '../lib/prisma'
import { assertProjectVersion, findDefaultVersionId, todayVersionDate } from '../lib/projectVersions'

import { EDITOR_SELECT, toEditor, type EditorRow } from './translations.service'

/** Keyset pagination on `(createdAt, id)`, newest first; offsets would skip or repeat events written between two pages. */
export const listActivity = async (prisma: PrismaClient, projectId: string, { cursor, limit }: ActivityListQuery): Promise<ActivityListResponse> => {
	let after: Prisma.ActivityEventWhereInput = {}
	if (cursor !== undefined) {
		const last = await prisma.activityEvent.findFirst({ where: { id: cursor, projectId }, select: { id: true, createdAt: true } })
		if (!last) {
			throw new AppError(400, ERROR_CODE.VALIDATION_ERROR, 'Cursor is not an event of the project', [{ path: 'cursor', code: VALIDATION_CODE.INVALID }])
		}
		after = { OR: [{ createdAt: { lt: last.createdAt } }, { createdAt: last.createdAt, id: { lt: last.id } }] }
	}
	const rows = await prisma.activityEvent.findMany({
		where: { projectId, ...after },
		orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
		take: limit + 1,
		select: { id: true, createdAt: true, count: true, type: true, payload: true, user: EDITOR_SELECT, version: { select: { id: true, name: true } } },
	})
	const page = rows.slice(0, limit)
	return {
		items: page.map(({ id, createdAt, count, user, version, type, payload }) => ({
			id,
			createdAt: createdAt.toISOString(),
			count,
			user: user && toEditor(user),
			version,
			...activityEventDataSchema.parse({ type, payload }),
		})),
		nextCursor: rows.length > limit ? (page.at(-1)?.id ?? null) : null,
	}
}

/**
 * The days of the range in `timeZone`, ending today there. `createdAt` is a UTC `timestamp` without zone, so it is read as UTC
 * before the conversion; the window bounds are converted the other way, so the filter stays on the `(projectId, createdAt)` index.
 * With a version only its events count, plus the project-level ones without a version.
 */
const periodSql = (projectId: string, versionId: string | null, timeZone: string, days: number) => Prisma.sql`
	period AS (
		SELECT
			(now() AT TIME ZONE ${timeZone}::text)::date - ${days - 1}::int AS first,
			(now() AT TIME ZONE ${timeZone}::text)::date AS last
	),
	events AS (
		SELECT e."userId", e.count, ((e."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timeZone}::text)::date AS date
		FROM "ActivityEvent" e, period p
		WHERE e."projectId" = ${projectId}::uuid
			AND (e."versionId" IS NULL OR e."versionId" = ${versionId}::uuid)
			AND e."createdAt" >= (p.first::timestamp AT TIME ZONE ${timeZone}::text) AT TIME ZONE 'UTC'
			AND e."createdAt" < ((p.last + 1)::timestamp AT TIME ZONE ${timeZone}::text) AT TIME ZONE 'UTC'
	)`

export const getActivityDaily = async (
	prisma: PrismaClient,
	projectId: string,
	{ versionId: requested, range, timeZone }: ActivityDailyQuery,
): Promise<ActivityDailyResponse> => {
	const versionId = requested ?? (await findDefaultVersionId(prisma, projectId, todayVersionDate()))
	if (versionId !== null) {
		await assertProjectVersion(prisma, projectId, versionId)
	}
	const period = periodSql(projectId, versionId, timeZone, ACTIVITY_RANGE_DAYS[range])
	const [days, contributors] = await Promise.all([
		prisma.$queryRaw<{ date: string; changes: number }[]>`
			WITH ${period}
			SELECT to_char(d, 'YYYY-MM-DD') AS date, COALESCE(sum(e.count), 0)::int AS changes
			FROM period p
			CROSS JOIN generate_series(p.first::timestamp, p.last::timestamp, interval '1 day') d
			LEFT JOIN events e ON e.date = d::date
			GROUP BY d
			ORDER BY d`,
		prisma.$queryRaw<(EditorRow & { changes: number })[]>`
			WITH ${period}
			SELECT u.id, u.email, u."firstName", u."lastName", sum(e.count)::int AS changes
			FROM events e
			JOIN "User" u ON u.id = e."userId"
			GROUP BY u.id
			HAVING sum(e.count) > 0
			ORDER BY changes DESC, COALESCE(NULLIF(concat_ws(' ', NULLIF(u."firstName", ''), NULLIF(u."lastName", '')), ''), u.email), u.id
			LIMIT ${ACTIVITY_CONTRIBUTORS_MAX}`,
	])
	return {
		days,
		contributors: contributors.map(({ changes, ...user }) => ({ user: toEditor(user), changes })),
	}
}
