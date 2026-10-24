import {
	ACTIVITY_CONTRIBUTORS_MAX,
	ACTIVITY_RANGE_DAYS,
	ACTIVITY_TYPE,
	ACTIVITY_TYPE_CATEGORY,
	activityEventDataSchema,
	type ActivityDailyQuery,
	type ActivityDailyResponse,
	type ActivityListQuery,
	type ActivityListResponse,
} from '@locale/shared'

import { Prisma } from '../generated/prisma/client'
import { type PrismaClient } from '../lib/prisma'
import { assertProjectVersion, findDefaultVersionId, todayVersionDate } from '../lib/projectVersions'

import { EDITOR_SELECT, toEditor, type EditorRow } from './translations.service'

const ACTIVITY_TYPES = Object.values(ACTIVITY_TYPE)

/**
 * Numbered pages, newest first. An event written while the user moves between pages shifts the rows by one; the history accepts that
 * for page numbers and a total, which keyset pagination cannot give.
 */
export const listActivity = async (
	prisma: PrismaClient,
	projectId: string,
	{ userId, category, versionId, from, to, page, pageSize }: ActivityListQuery,
): Promise<ActivityListResponse> => {
	const where: Prisma.ActivityEventWhereInput = {
		projectId,
		userId,
		versionId,
		type: category && { in: ACTIVITY_TYPES.filter((type) => ACTIVITY_TYPE_CATEGORY[type] === category) },
		createdAt: from || to ? { gte: from, lt: to } : undefined,
	}
	const [rows, total, users] = await Promise.all([
		prisma.activityEvent.findMany({
			where,
			orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
			skip: (page - 1) * pageSize,
			take: pageSize,
			select: { id: true, createdAt: true, count: true, type: true, payload: true, user: EDITOR_SELECT, version: { select: { id: true, name: true } } },
		}),
		prisma.activityEvent.count({ where }),
		prisma.user.findMany({ where: { activityEvents: { some: { projectId } } }, ...EDITOR_SELECT }),
	])
	return {
		items: rows.map(({ id, createdAt, count, user, version, type, payload }) => ({
			id,
			createdAt: createdAt.toISOString(),
			count,
			user: user && toEditor(user),
			version,
			...activityEventDataSchema.parse({ type, payload }),
		})),
		total,
		page,
		pageSize,
		users: users.map(toEditor).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)),
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
