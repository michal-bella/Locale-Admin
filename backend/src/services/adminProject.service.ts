import { ERROR_CODE, VALIDATION_CODE, type ProjectSettings, type UpdateProjectSettingsRequest } from '@locale/shared'

import { type Prisma, type Project } from '../generated/prisma/client'
import { AppError } from '../lib/errors'
import { type PrismaClient } from '../lib/prisma'

import { setBaseLanguage } from './adminLanguages.service'

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

/** There is one project for now; the oldest one is the project of the app. */
const findProject = (prisma: PrismaClient | Prisma.TransactionClient) => prisma.project.findFirst({ select: PROJECT_SELECT, orderBy: { createdAt: 'asc' } })

export const getProjectSettings = async (prisma: PrismaClient): Promise<ProjectSettings> => {
	const [project, baseLanguage] = await Promise.all([findProject(prisma), prisma.language.findFirst({ where: { isBase: true }, select: { id: true } })])
	if (!project) {
		throw notFound()
	}
	return toProjectSettings(project, baseLanguage?.id ?? null)
}

export const updateProjectSettings = async (prisma: PrismaClient, { baseLanguageId, ...settings }: UpdateProjectSettingsRequest): Promise<ProjectSettings> =>
	prisma.$transaction(async (tx) => {
		const project = await findProject(tx)
		if (!project) {
			throw notFound()
		}
		if (!(await setBaseLanguage(tx, baseLanguageId))) {
			throw new AppError(400, ERROR_CODE.VALIDATION_ERROR, 'Base language not found', [{ path: 'baseLanguageId', code: VALIDATION_CODE.INVALID }])
		}
		const updated = await tx.project.update({ where: { id: project.id }, data: settings, select: PROJECT_SELECT })
		return toProjectSettings(updated, baseLanguageId)
	})
