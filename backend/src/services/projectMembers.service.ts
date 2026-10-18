import { ERROR_CODE, type CreateProjectMemberRequest, type ProjectMember } from '@locale/shared'

import { type Prisma } from '../generated/prisma/client'
import { ROLE } from '../generated/prisma/enums'
import { AppError } from '../lib/errors'
import { hashPassword } from '../lib/password'
import { type PrismaClient } from '../lib/prisma'

import { isPrismaError } from './projects.service'

const MEMBER_SELECT = {
	createdAt: true,
	user: { select: { id: true, email: true, firstName: true, lastName: true } },
} satisfies Prisma.ProjectMemberSelect

const toProjectMember = ({ createdAt, user }: Prisma.ProjectMemberGetPayload<{ select: typeof MEMBER_SELECT }>): ProjectMember => ({
	...user,
	createdAt: createdAt.toISOString(),
})

export const listProjectMembers = async (prisma: PrismaClient, projectId: string): Promise<ProjectMember[]> => {
	const members = await prisma.projectMember.findMany({
		where: { projectId },
		select: MEMBER_SELECT,
		orderBy: [{ createdAt: 'asc' }, { userId: 'asc' }],
	})
	return members.map(toProjectMember)
}

/** Creates a new EDITOR who is a member of the project. An existing email is a conflict, adding existing users comes later. */
export const createProjectMember = async (prisma: PrismaClient, projectId: string, { email, password }: CreateProjectMemberRequest): Promise<ProjectMember> => {
	const passwordHash = await hashPassword(password)
	try {
		const member = await prisma.projectMember.create({
			data: {
				project: { connect: { id: projectId } },
				user: { create: { email, passwordHash, role: ROLE.EDITOR, passwordChangedAt: new Date() } },
			},
			select: MEMBER_SELECT,
		})
		return toProjectMember(member)
	} catch (err) {
		if (isPrismaError(err, 'P2002')) {
			throw new AppError(409, ERROR_CODE.EMAIL_TAKEN, 'Email is already taken')
		}
		throw err
	}
}
