import { ERROR_CODE, ROLE, type AuthUser, type CreateProjectRequest, type LanguageTag, type ProjectListItem, type ReorderProjectsRequest } from '@locale/shared'

import { Prisma } from '../generated/prisma/client'
import { AppError } from '../lib/errors'
import { type PrismaClient } from '../lib/prisma'

const PROJECT_LIST_SELECT = {
	id: true,
	name: true,
	slug: true,
	primaryColor: true,
	createdAt: true,
	languages: { select: { id: true, tag: true }, orderBy: [{ isBase: 'desc' }, { position: 'asc' }, { tag: 'asc' }] },
	_count: { select: { translationKeys: true, members: true } },
} satisfies Prisma.ProjectSelect

type ProjectListRow = Prisma.ProjectGetPayload<{ select: typeof PROJECT_LIST_SELECT }>

// `tag` is always a catalog value (written only from the validated API and the seed).
const toListItem = ({ languages, _count, createdAt, ...project }: ProjectListRow, isMember: boolean, translatedCount: number): ProjectListItem => ({
	...project,
	isMember,
	languageTags: languages.map((language) => language.tag as LanguageTag),
	keyCount: _count.translationKeys,
	translatedCount,
	memberCount: _count.members,
	createdAt: createdAt.toISOString(),
})

export const isPrismaError = (err: unknown, code: string): boolean => err instanceof Prisma.PrismaClientKnownRequestError && err.code === code

export const slugTaken = () => new AppError(409, ERROR_CODE.SLUG_TAKEN, 'Project slug is already taken')

export const hasProjectAccess = async (prisma: PrismaClient, projectId: string, user: AuthUser): Promise<boolean> => {
	if (user.role === ROLE.ADMIN) {
		return (await prisma.project.count({ where: { id: projectId } })) > 0
	}
	return (await prisma.projectMember.count({ where: { projectId, userId: user.id } })) > 0
}

const visibleProjects = (user: AuthUser) => (user.role === ROLE.ADMIN ? {} : { members: { some: { userId: user.id } } })

/** The user's own order first (`ProjectOrder.position`), then by name; the sort is in JS because the position is per user. */
export const listProjects = async (prisma: PrismaClient, user: AuthUser): Promise<ProjectListItem[]> => {
	const [projects, orders] = await Promise.all([
		prisma.project.findMany({
			where: visibleProjects(user),
			select: { ...PROJECT_LIST_SELECT, members: { where: { userId: user.id }, select: { userId: true } } },
			orderBy: [{ name: 'asc' }, { id: 'asc' }],
		}),
		prisma.projectOrder.findMany({ where: { userId: user.id }, select: { projectId: true, position: true } }),
	])
	const filled = await prisma.translation.groupBy({
		by: ['languageId'],
		where: { value: { not: null }, languageId: { in: projects.flatMap((project) => project.languages.map((language) => language.id)) } },
		_count: { _all: true },
	})
	const filledByLanguage = new Map(filled.map(({ languageId, _count }) => [languageId, _count._all]))
	const positions = new Map(orders.map(({ projectId, position }) => [projectId, position]))
	const position = (projectId: string) => positions.get(projectId) ?? Number.MAX_SAFE_INTEGER
	// Stable sort, so projects with the same (missing) position keep the name order of the query.
	return projects
		.map(({ members, ...project }) =>
			toListItem(
				project,
				members.length > 0,
				project.languages.reduce((sum, language) => sum + (filledByLanguage.get(language.id) ?? 0), 0),
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

/** The creator becomes the first member, the first language the base. No pre-check for the slug: the unique constraint (P2002) also covers concurrent requests. */
export const createProject = async (prisma: PrismaClient, userId: string, { name, slug, languageTags }: CreateProjectRequest): Promise<ProjectListItem> => {
	try {
		const project = await prisma.project.create({
			data: {
				name,
				slug,
				members: { create: { userId } },
				languages: { create: languageTags.map((tag, index) => ({ tag, isBase: index === 0, position: index })) },
			},
			select: PROJECT_LIST_SELECT,
		})
		return toListItem(project, true, 0)
	} catch (err) {
		if (isPrismaError(err, 'P2002')) {
			throw slugTaken()
		}
		throw err
	}
}

/**
 * Removes a member: leaving the project (the user themselves) or removing another member.
 * The project row lock serializes concurrent removals, so the last two members cannot both go.
 */
export const removeProjectMember = async (prisma: PrismaClient, projectId: string, userId: string): Promise<void> =>
	prisma.$transaction(async (tx) => {
		await tx.$queryRaw`SELECT id FROM "Project" WHERE id = ${projectId}::uuid FOR UPDATE`
		const members = await tx.projectMember.findMany({ where: { projectId }, select: { userId: true } })
		if (!members.some((member) => member.userId === userId)) {
			throw new AppError(404, ERROR_CODE.NOT_FOUND, 'Not a member of the project')
		}
		if (members.length === 1) {
			throw new AppError(409, ERROR_CODE.LAST_MEMBER, 'The last member cannot be removed from the project')
		}
		await tx.projectMember.delete({ where: { projectId_userId: { projectId, userId } } })
	})
