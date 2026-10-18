import { ERROR_CODE, ROLE, VALIDATION_CODE, type AuthUser, type ProjectSettings, type UpdateProjectSettingsRequest } from '@locale/shared'

import { type Prisma, type Project } from '../generated/prisma/client'
import { AppError } from '../lib/errors'
import { type PrismaClient } from '../lib/prisma'

import { setBaseLanguage } from './adminLanguages.service'
import { isPrismaError, slugTaken } from './projects.service'

const PROJECT_SELECT = {
	id: true,
	name: true,
	slug: true,
	primaryColor: true,
	protectVariables: true,
} satisfies Prisma.ProjectSelect

const toProjectSettings = (project: Pick<Project, keyof typeof PROJECT_SELECT>, baseLanguageId: string | null): ProjectSettings => ({
	id: project.id,
	name: project.name,
	slug: project.slug,
	primaryColor: project.primaryColor,
	protectVariables: project.protectVariables,
	baseLanguageId,
})

const notFound = () => new AppError(404, ERROR_CODE.NOT_FOUND, 'Project not found')

const findBaseLanguageId = async (prisma: PrismaClient | Prisma.TransactionClient): Promise<string | null> =>
	(await prisma.language.findFirst({ where: { isBase: true }, select: { id: true } }))?.id ?? null

export const getProjectSettings = async (prisma: PrismaClient, projectId: string): Promise<ProjectSettings> => {
	const [project, baseLanguageId] = await Promise.all([
		prisma.project.findUnique({ where: { id: projectId }, select: PROJECT_SELECT }),
		findBaseLanguageId(prisma),
	])
	if (!project) {
		throw notFound()
	}
	return toProjectSettings(project, baseLanguageId)
}

/** The base language is global, so only an ADMIN may change it. Sending the current base language is allowed to anyone. */
export const updateProjectSettings = async (
	prisma: PrismaClient,
	projectId: string,
	user: AuthUser,
	{ baseLanguageId, ...settings }: UpdateProjectSettingsRequest,
): Promise<ProjectSettings> => {
	try {
		return await prisma.$transaction(async (tx) => {
			if (baseLanguageId !== undefined && baseLanguageId !== (await findBaseLanguageId(tx))) {
				if (user.role !== ROLE.ADMIN) {
					throw new AppError(403, ERROR_CODE.FORBIDDEN, 'Only an admin can change the base language')
				}
				if (!(await setBaseLanguage(tx, baseLanguageId))) {
					throw new AppError(400, ERROR_CODE.VALIDATION_ERROR, 'Base language not found', [{ path: 'baseLanguageId', code: VALIDATION_CODE.INVALID }])
				}
			}
			const updated = await tx.project.update({ where: { id: projectId }, data: settings, select: PROJECT_SELECT })
			return toProjectSettings(updated, await findBaseLanguageId(tx))
		})
	} catch (err) {
		if (isPrismaError(err, 'P2025')) {
			throw notFound()
		}
		if (isPrismaError(err, 'P2002')) {
			throw slugTaken()
		}
		throw err
	}
}
