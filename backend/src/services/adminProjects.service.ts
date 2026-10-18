import { ERROR_CODE, type AdminProjectListItem, type LanguageTag } from '@locale/shared'

import { AppError } from '../lib/errors'
import { type PrismaClient } from '../lib/prisma'

export const listAllProjects = async (prisma: PrismaClient): Promise<AdminProjectListItem[]> => {
	const projects = await prisma.project.findMany({
		select: {
			id: true,
			name: true,
			slug: true,
			primaryColor: true,
			createdAt: true,
			languages: { where: { isBase: true }, select: { tag: true } },
			_count: { select: { languages: true, members: true } },
		},
		orderBy: [{ name: 'asc' }, { id: 'asc' }],
	})
	// `tag` is always a catalog value (written only from the validated API and the seed).
	return projects.map(({ languages, _count, createdAt, ...project }) => ({
		...project,
		baseLanguageTag: (languages[0]?.tag as LanguageTag | undefined) ?? null,
		languageCount: _count.languages,
		memberCount: _count.members,
		createdAt: createdAt.toISOString(),
	}))
}

/** Members and languages cascade, users stay. `deleteMany` so a concurrent delete returns 404 instead of throwing P2025. */
export const deleteProject = async (prisma: PrismaClient, id: string): Promise<void> => {
	const { count } = await prisma.project.deleteMany({ where: { id } })
	if (count === 0) {
		throw new AppError(404, ERROR_CODE.NOT_FOUND, 'Project not found')
	}
}
