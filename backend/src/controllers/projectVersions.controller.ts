import { type RequestHandler } from 'express'
import { z } from 'zod'

import {
	createProjectVersionRequestSchema,
	type ProjectVersion,
	type ProjectVersionsResponse,
	updateProjectVersionRequestSchema,
	type VersionDiffSummary,
} from '@locale/shared'

import { type PrismaClient } from '../lib/prisma'
import { versionNotFound } from '../lib/projectVersions'
import { getAuth } from '../middleware/auth.middleware'
import {
	createProjectVersion,
	deleteProjectVersion,
	getVersionDiffSummary,
	listProjectVersions,
	updateProjectVersion,
} from '../services/projectVersions.service'

type Params = { projectId: string; versionId: string }

/** A non-UUID id would make Postgres fail with 500, so it is rejected with the same 404 as an unknown id. */
const parseVersionId = (value: string): string => {
	const id = z.uuid().safeParse(value)
	if (!id.success) {
		throw versionNotFound()
	}
	return id.data
}

export const createListProjectVersionsController =
	(prisma: PrismaClient): RequestHandler<Pick<Params, 'projectId'>> =>
	async (req, res) => {
		const body: ProjectVersionsResponse = await listProjectVersions(prisma, req.params.projectId)
		res.status(200).json(body)
	}

export const createCreateProjectVersionController =
	(prisma: PrismaClient): RequestHandler<Pick<Params, 'projectId'>> =>
	async (req, res) => {
		const input = createProjectVersionRequestSchema.parse(req.body)
		const body: ProjectVersion = await createProjectVersion(prisma, { projectId: req.params.projectId, userId: getAuth(req).user.id }, input)
		res.status(201).json(body)
	}

export const createUpdateProjectVersionController =
	(prisma: PrismaClient): RequestHandler<Params> =>
	async (req, res) => {
		const input = updateProjectVersionRequestSchema.parse(req.body)
		const ids = { projectId: req.params.projectId, userId: getAuth(req).user.id }
		const body: ProjectVersion = await updateProjectVersion(prisma, ids, parseVersionId(req.params.versionId), input)
		res.status(200).json(body)
	}

export const createDeleteProjectVersionController =
	(prisma: PrismaClient): RequestHandler<Params> =>
	async (req, res) => {
		await deleteProjectVersion(prisma, { projectId: req.params.projectId, userId: getAuth(req).user.id }, parseVersionId(req.params.versionId))
		res.status(204).end()
	}

export const createGetVersionDiffController =
	(prisma: PrismaClient): RequestHandler<Params> =>
	async (req, res) => {
		const body: VersionDiffSummary = await getVersionDiffSummary(prisma, req.params.projectId, parseVersionId(req.params.versionId))
		res.status(200).json(body)
	}
