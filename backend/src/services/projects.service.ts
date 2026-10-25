import {
	ACTIVITY_TYPE,
	ERROR_CODE,
	ROLE,
	type AuthUser,
	type ProjectAccessRole,
	type CreateProjectRequest,
	type LanguageTag,
	type ProjectListItem,
	type ReorderProjectsRequest,
} from '@locale/shared'

import { Prisma } from '../generated/prisma/client'
import { recordActivity } from '../lib/activity'
import { PROJECT_ROLE_FROM_PRISMA } from '../lib/authUser'
import { AppError } from '../lib/errors'
import { type PrismaClient } from '../lib/prisma'
import { toDbDate, todayVersionDate } from '../lib/projectVersions'

const PROJECT_LIST_SELECT = {
	id: true,
	name: true,
	slug: true,
	primaryColor: true,
	createdAt: true,
	languages: { select: { id: true, tag: true }, orderBy: [{ isBase: 'desc' }, { position: 'asc' }, { tag: 'asc' }] },
	_count: { select: { members: true } },
} satisfies Prisma.ProjectSelect

type ProjectListRow = Prisma.ProjectGetPayload<{ select: typeof PROJECT_LIST_SELECT }>

type VersionCounts = { keyCount: number; translatedCount: number }

// `tag` is always a catalog value (written only from the validated API and the seed).
const toListItem = (
	{ languages, _count, createdAt, ...project }: ProjectListRow,
	{ isMember, myRole }: Pick<ProjectListItem, 'isMember' | 'myRole'>,
	counts: VersionCounts,
): ProjectListItem => ({
	...project,
	isMember,
	myRole,
	languageTags: languages.map((language) => language.tag as LanguageTag),
	...counts,
	memberCount: _count.members,
	createdAt: createdAt.toISOString(),
})

/**
 * Keys and filled values of each project's default version (the current one by date, else the newest; see `findDefaultVersionId`),
 * zero for a project without versions. Every version holds its own copy of the keys, so counting the project would multiply them.
 */
const countDefaultVersions = async (prisma: PrismaClient, projectIds: string[]): Promise<Map<string, VersionCounts>> => {
	if (projectIds.length === 0) {
		return new Map()
	}
	const today = toDbDate(todayVersionDate())
	const rows = await prisma.$queryRaw<{ projectId: string; keyCount: number; translatedCount: number }[]>`
		WITH shown AS (
			SELECT DISTINCT ON (v."projectId") v."projectId", v.id
			FROM "ProjectVersion" v
			WHERE v."projectId" IN (${Prisma.join(projectIds.map((id) => Prisma.sql`${id}::uuid`))})
			ORDER BY v."projectId", (v."startsAt" <= ${today} AND v."endsAt" >= ${today}) DESC, v."startsAt" DESC, v."createdAt" DESC
		)
		SELECT shown."projectId",
			(SELECT count(*)::int FROM "TranslationKey" k WHERE k."versionId" = shown.id) AS "keyCount",
			(SELECT count(*)::int FROM "Translation" t JOIN "TranslationKey" k ON k.id = t."keyId" WHERE k."versionId" = shown.id AND t.value IS NOT NULL) AS "translatedCount"
		FROM shown`
	return new Map(rows.map(({ projectId, ...counts }) => [projectId, counts]))
}

export const isPrismaError = (err: unknown, code: string): boolean => err instanceof Prisma.PrismaClientKnownRequestError && err.code === code

export const slugTaken = () => new AppError(409, ERROR_CODE.SLUG_TAKEN, 'Project slug is already taken')

/** What the user may do in the project: `ADMIN` for an admin, the membership role for a member, `null` without access (or no such project). */
export const getProjectRole = async (prisma: PrismaClient, projectId: string, user: AuthUser): Promise<ProjectAccessRole | null> => {
	if (user.role === ROLE.ADMIN) {
		return (await prisma.project.count({ where: { id: projectId } })) > 0 ? ROLE.ADMIN : null
	}
	const membership = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId: user.id } }, select: { role: true } })
	return membership ? PROJECT_ROLE_FROM_PRISMA[membership.role] : null
}

const visibleProjects = (user: AuthUser) => (user.role === ROLE.ADMIN ? {} : { members: { some: { userId: user.id } } })

/** The user's own order first (`ProjectOrder.position`), then by name; the sort is in JS because the position is per user. */
export const listProjects = async (prisma: PrismaClient, user: AuthUser): Promise<ProjectListItem[]> => {
	const [projects, orders] = await Promise.all([
		prisma.project.findMany({
			where: visibleProjects(user),
			select: { ...PROJECT_LIST_SELECT, members: { where: { userId: user.id }, select: { role: true } } },
			orderBy: [{ name: 'asc' }, { id: 'asc' }],
		}),
		prisma.projectOrder.findMany({ where: { userId: user.id }, select: { projectId: true, position: true } }),
	])
	const counts = await countDefaultVersions(
		prisma,
		projects.map((project) => project.id),
	)
	const positions = new Map(orders.map(({ projectId, position }) => [projectId, position]))
	const position = (projectId: string) => positions.get(projectId) ?? Number.MAX_SAFE_INTEGER
	// Stable sort, so projects with the same (missing) position keep the name order of the query.
	return projects
		.map(({ members: [membership], ...project }) =>
			toListItem(
				project,
				// Only an ADMIN sees a project without a membership (`visibleProjects`).
				{ isMember: membership !== undefined, myRole: membership && user.role !== ROLE.ADMIN ? PROJECT_ROLE_FROM_PRISMA[membership.role] : ROLE.ADMIN },
				counts.get(project.id) ?? { keyCount: 0, translatedCount: 0 },
			),
		)
		.sort((a, b) => position(a.id) - position(b.id))
}

/** Replaces the user's order with `projectIds`; every id must be a project the user sees (404 otherwise, nothing is written). */
export const reorderProjects = async (prisma: PrismaClient, user: AuthUser, { projectIds }: ReorderProjectsRequest): Promise<void> =>
	prisma.$transaction(async (tx) => {
		const visible = await tx.project.count({ where: { id: { in: projectIds }, ...visibleProjects(user) } })
		if (visible !== projectIds.length) {
			throw new AppError(404, ERROR_CODE.NOT_FOUND, 'Project not found')
		}
		await tx.projectOrder.deleteMany({ where: { userId: user.id } })
		await tx.projectOrder.createMany({ data: projectIds.map((projectId, position) => ({ userId: user.id, projectId, position })) })
	})

/** The creator is an ADMIN and does not become a member; the first language is the base. No pre-check for the slug: the unique constraint (P2002) also covers concurrent requests. */
export const createProject = async (prisma: PrismaClient, userId: string, { name, slug, languageTags }: CreateProjectRequest): Promise<ProjectListItem> => {
	try {
		const project = await prisma.$transaction(async (tx) => {
			const created = await tx.project.create({
				data: {
					name,
					slug,
					languages: { create: languageTags.map((tag, index) => ({ tag, isBase: index === 0, position: index })) },
				},
				select: PROJECT_LIST_SELECT,
			})
			await recordActivity(tx, { projectId: created.id, userId, type: ACTIVITY_TYPE.PROJECT_CREATED, payload: { name } })
			return created
		})
		return toListItem(project, { isMember: false, myRole: ROLE.ADMIN }, { keyCount: 0, translatedCount: 0 })
	} catch (err) {
		if (isPrismaError(err, 'P2002')) {
			throw slugTaken()
		}
		throw err
	}
}

/**
 * Removes a member: leaving the project (the user themselves, `actorId === userId`) or removing another member.
 * The last member may go too: every ADMIN keeps working in the project without a membership.
 */
export const removeProjectMember = async (prisma: PrismaClient, projectId: string, userId: string, actorId: string): Promise<void> =>
	prisma.$transaction(async (tx) => {
		// Serializes concurrent removals of the same member, so the second one gets 404 instead of a failed delete.
		await tx.$queryRaw`SELECT id FROM "Project" WHERE id = ${projectId}::uuid FOR UPDATE`
		const member = await tx.projectMember.findUnique({ where: { projectId_userId: { projectId, userId } }, select: { userId: true } })
		if (!member) {
			throw new AppError(404, ERROR_CODE.NOT_FOUND, 'Not a member of the project')
		}
		const { user } = await tx.projectMember.delete({
			where: { projectId_userId: { projectId, userId } },
			select: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
		})
		await recordActivity(tx, { projectId, userId: actorId, type: ACTIVITY_TYPE.MEMBER_REMOVED, payload: { member: user, left: userId === actorId } })
	})
