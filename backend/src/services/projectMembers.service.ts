import { ACTIVITY_TYPE, ERROR_CODE, ROLE, type AddProjectMemberRequest, type ProjectMember, type UpdateProjectMemberRequest } from '@locale/shared'

import { type Prisma } from '../generated/prisma/client'
import { recordActivity } from '../lib/activity'
import { ACTIVE_MEMBERSHIP, PROJECT_ROLE_FROM_PRISMA, PROJECT_ROLE_TO_PRISMA, ROLE_FROM_PRISMA } from '../lib/authUser'
import { AppError } from '../lib/errors'
import { type PrismaClient } from '../lib/prisma'

import { isPrismaError } from './projects.service'

const MEMBER_SELECT = {
	role: true,
	createdAt: true,
	user: { select: { id: true, email: true, firstName: true, lastName: true, _count: { select: { projectMemberships: true } } } },
} satisfies Prisma.ProjectMemberSelect

const toProjectMember = ({ role, createdAt, user: { _count, ...user } }: Prisma.ProjectMemberGetPayload<{ select: typeof MEMBER_SELECT }>): ProjectMember => ({
	...user,
	role: PROJECT_ROLE_FROM_PRISMA[role],
	projectCount: _count.projectMemberships,
	createdAt: createdAt.toISOString(),
})

export const listProjectMembers = async (prisma: PrismaClient, projectId: string): Promise<ProjectMember[]> => {
	const members = await prisma.projectMember.findMany({
		where: { projectId, ...ACTIVE_MEMBERSHIP },
		select: MEMBER_SELECT,
		orderBy: [{ createdAt: 'asc' }, { userId: 'asc' }],
	})
	return members.map(toProjectMember)
}

/**
 * Adds an existing user to the project. A missing user fails the `connect` (P2025), an existing membership the composite key (P2002).
 * An ADMIN works in every project without a membership, so adding one is 409 `MEMBER_IS_ADMIN`.
 */
export const addProjectMember = async (
	prisma: PrismaClient,
	projectId: string,
	actorId: string,
	{ userId, role }: AddProjectMemberRequest,
): Promise<ProjectMember> => {
	try {
		const member = await prisma.$transaction(async (tx) => {
			const user = await tx.user.findUnique({ where: { id: userId }, select: { role: true } })
			if (user && ROLE_FROM_PRISMA[user.role] === ROLE.ADMIN) {
				throw new AppError(409, ERROR_CODE.MEMBER_IS_ADMIN, 'An admin works in every project without a membership')
			}
			const created = await tx.projectMember.create({
				data: { project: { connect: { id: projectId } }, user: { connect: { id: userId } }, role: PROJECT_ROLE_TO_PRISMA[role] },
				select: MEMBER_SELECT,
			})
			const { id, firstName, lastName, email } = created.user
			await recordActivity(tx, { projectId, userId: actorId, type: ACTIVITY_TYPE.MEMBER_ADDED, payload: { member: { id, firstName, lastName, email } } })
			return created
		})
		return toProjectMember(member)
	} catch (err) {
		if (isPrismaError(err, 'P2025')) {
			throw new AppError(404, ERROR_CODE.NOT_FOUND, 'User not found')
		}
		if (isPrismaError(err, 'P2002')) {
			throw new AppError(409, ERROR_CODE.ALREADY_MEMBER, 'The user is already a member of the project')
		}
		throw err
	}
}

/** Changes the role of a member (404 for anyone else); the same role is a no-op without an activity event. */
export const updateProjectMember = async (
	prisma: PrismaClient,
	projectId: string,
	userId: string,
	actorId: string,
	{ role }: UpdateProjectMemberRequest,
): Promise<ProjectMember> =>
	prisma.$transaction(async (tx) => {
		const current = await tx.projectMember.findUnique({ where: { projectId_userId: { projectId, userId } }, select: { role: true } })
		if (!current) {
			throw new AppError(404, ERROR_CODE.NOT_FOUND, 'Not a member of the project')
		}
		const updated = await tx.projectMember.update({
			where: { projectId_userId: { projectId, userId } },
			data: { role: PROJECT_ROLE_TO_PRISMA[role] },
			select: MEMBER_SELECT,
		})
		const fromRole = PROJECT_ROLE_FROM_PRISMA[current.role]
		if (fromRole !== role) {
			const { id, firstName, lastName, email } = updated.user
			await recordActivity(tx, {
				projectId,
				userId: actorId,
				type: ACTIVITY_TYPE.MEMBER_ROLE_CHANGED,
				payload: { member: { id, firstName, lastName, email }, fromRole, toRole: role },
			})
		}
		return toProjectMember(updated)
	})
