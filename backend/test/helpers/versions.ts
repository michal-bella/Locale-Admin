import { randomUUID } from 'node:crypto'

import { type VERSION_LOCK, toVersionDate } from '@locale/shared'

import { toDbDate } from '../../src/lib/projectVersions'

import { getTestPrisma } from './db'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type VersionWindow = { name?: string; startsAt?: string; endsAt?: string; lock?: VERSION_LOCK; importedAt?: Date | null }

/** `YYYY-MM-DD` of today plus `days` in the local calendar of the test runner, the one the server reads too. */
export const dayShift = (days: number) => toVersionDate(new Date(Date.now() + days * 86_400_000))

/** A version of the project; by default a running one (started 5 days ago, 5 days left) called `v1` that already had an import, so keys can go in. */
export const createVersionRow = (
	projectId: string,
	{ name = 'v1', startsAt = dayShift(-5), endsAt = dayShift(5), lock, importedAt = new Date() }: VersionWindow = {},
) => getTestPrisma().projectVersion.create({ data: { projectId, name, startsAt: toDbDate(startsAt), endsAt: toDbDate(endsAt), lock, importedAt } })

/**
 * The first version of the project (the one `setup` created) for keys and queries of tests that do not care which version they use; a project
 * without one gets a running `v1` on the spot. An unknown project (a 404 test) cannot get a version, so the request carries a random id.
 */
export const versionIdOf = async (projectId: string) => {
	if (!UUID.test(projectId)) {
		return randomUUID()
	}
	const existing = await getTestPrisma().projectVersion.findFirst({ where: { projectId }, orderBy: { createdAt: 'asc' }, select: { id: true } })
	if (existing) {
		return existing.id
	}
	return createVersionRow(projectId)
		.then((version) => version.id)
		.catch(() => randomUUID())
}
