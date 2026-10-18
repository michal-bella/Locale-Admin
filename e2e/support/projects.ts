import { randomBytes } from 'node:crypto'

import { type APIRequestContext, expect } from '@playwright/test'

import { MUTATION_HEADERS } from './api'

export type ProjectListItem = { id: string; name: string; slug: string; primaryColor: string; isMember: boolean }

export type ProjectSettings = {
	id: string
	name: string
	slug: string
	primaryColor: string
	protectVariables: boolean
	baseLanguageId: string | null
}

export const PROJECTS_API = '/api/projects'

export const projectSettingsApi = (projectId: string) => `${PROJECTS_API}/${projectId}/settings`

export const projectMembersApi = (projectId: string) => `${PROJECTS_API}/${projectId}/members`

export const projectMembershipApi = (projectId: string) => `${PROJECTS_API}/${projectId}/membership`

/** Every project the suite creates has a slug with this prefix, so the teardown can delete them (the seeded project never has it). */
export const TEST_PROJECT_SLUG_PREFIX = 'e2e-tmp-'

export const newTestProjectInput = (label: string) => {
	const suffix = `${Date.now()}-${randomBytes(3).toString('hex')}`
	return { name: `E2E ${label} ${suffix}`, slug: `${TEST_PROJECT_SLUG_PREFIX}${label}-${suffix}` }
}

/** Creates a project as the user of `api`, who becomes its member. */
export const createProject = async (api: APIRequestContext, label: string) => {
	const response = await api.post(PROJECTS_API, { data: newTestProjectInput(label), headers: MUTATION_HEADERS })
	expect(response.status(), `POST ${PROJECTS_API}`).toBe(201)
	return (await response.json()) as ProjectListItem
}

export const listProjects = async (api: APIRequestContext) => {
	const response = await api.get(PROJECTS_API)
	expect(response.status(), `GET ${PROJECTS_API}`).toBe(200)
	return ((await response.json()) as { projects: ProjectListItem[] }).projects
}

export const getProjectSettings = async (api: APIRequestContext, projectId: string) => {
	const response = await api.get(projectSettingsApi(projectId))
	expect(response.status(), `GET ${projectSettingsApi(projectId)}`).toBe(200)
	return (await response.json()) as ProjectSettings
}
