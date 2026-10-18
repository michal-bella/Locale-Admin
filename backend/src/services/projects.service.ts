import { ERROR_CODE, ROLE, type AuthUser, type CreateProjectRequest, type ProjectListItem } from '@locale/shared'

import { Prisma } from '../generated/prisma/client'
import { AppError } from '../lib/errors'
import { type PrismaClient } from '../lib/prisma'

const PROJECT_LIST_SELECT = { id: true, name: true, slug: true, primaryColor: true } satisfies Prisma.ProjectSelect

export const isPrismaError = (err: unknown, code: string): boolean => err instanceof Prisma.PrismaClientKnownRequestError && err.code === code

export const slugTaken = () => new AppError(409, ERROR_CODE.SLUG_TAKEN, 'Project slug is already taken')

export const hasProjectAccess = async (prisma: PrismaClient, projectId: string, user: AuthUser): Promise<boolean> => {
	if (user.role === ROLE.ADMIN) {
		return (await prisma.project.count({ where: { id: projectId } })) > 0
	}
	return (await prisma.projectMember.count({ where: { projectId, userId: user.id } })) > 0
}

export const listProjects = async (prisma: PrismaClient, user: AuthUser): Promise<ProjectListItem[]> => {
	const projects = await prisma.project.findMany({
		where: user.role === ROLE.ADMIN ? {} : { members: { some: { userId: user.id } } },
		select: { ...PROJECT_LIST_SELECT, members: { where: { userId: user.id }, select: { userId: true } } },
		orderBy: [{ name: 'asc' }, { id: 'asc' }],
	})
	return projects.map(({ members, ...project }) => ({ ...project, isMember: members.length > 0 }))
}

/** The creator becomes the first member. No pre-check for the slug: the unique constraint (P2002) also covers concurrent requests. */
export const createProject = async (prisma: PrismaClient, userId: string, input: CreateProjectRequest): Promise<ProjectListItem> => {
	try {
		const project = await prisma.project.create({
			data: { ...input, members: { create: { userId } } },
			select: PROJECT_LIST_SELECT,
		})
		return { ...project, isMember: true }
	} catch (err) {
		if (isPrismaError(err, 'P2002')) {
			throw slugTaken()
		}
		throw err
	}
}

/** The project row lock serializes concurrent leaves, so the last two members cannot both leave. */
export const leaveProject = async (prisma: PrismaClient, projectId: string, userId: string): Promise<void> =>
	prisma.$transaction(async (tx) => {
		await tx.$queryRaw`SELECT id FROM "Project" WHERE id = ${projectId}::uuid FOR UPDATE`
		const members = await tx.projectMember.findMany({ where: { projectId }, select: { userId: true } })
		if (!members.some((member) => member.userId === userId)) {
			throw new AppError(404, ERROR_CODE.NOT_FOUND, 'Not a member of the project')
		}
		if (members.length === 1) {
			throw new AppError(409, ERROR_CODE.LAST_MEMBER, 'The last member cannot leave the project')
		}
		await tx.projectMember.delete({ where: { projectId_userId: { projectId, userId } } })
	})
