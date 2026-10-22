import { type APIRequestContext, expect, type Page } from '@playwright/test'

import { MUTATION_HEADERS } from './api'
import { createProject, type ProjectListItem } from './projects'

export type ProjectVersion = {
	id: string
	name: string
	startsAt: string
	endsAt: string
	lock: 'AUTO' | 'LOCKED' | 'UNLOCKED'
	isLocked: boolean
	state: 'UPCOMING' | 'ACTIVE' | 'LOCKED'
	isCurrent: boolean
	/** Time of the last import, `null` for an empty version (no keys yet). */
	importedAt: string | null
	keyCount: number
	createdAt: string
	createdBy: { id: string; name: string } | null
}

export const versionsApi = (projectId: string) => `/api/projects/${projectId}/versions`

export const versionsPath = (projectSlug: string) => `/projects/${projectSlug}/versions`

/** `YYYY-MM-DD` of today plus `days` in the local calendar, the same the browser and the server on this machine use. */
export const dayShift = (days: number) => {
	const date = new Date(Date.now() + days * 86_400_000)
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** `YYYY-MM-DD` as the date field shows it in `sk` (`8. 9. 2026`). */
export const formatVersionDate = (isoDate: string) => {
	const [year, month, day] = isoDate.split('-').map(Number)
	return `${day}. ${month}. ${year}`
}

/** A version running today: started 2 days ago, 12 days left. */
export const CURRENT_WINDOW = { startsAt: dayShift(-2), endsAt: dayShift(12) }

/** A version whose end is 20 days back, so `AUTO` locks it. */
export const PAST_WINDOW = { startsAt: dayShift(-40), endsAt: dayShift(-20) }

/** A version starting in 5 days: `Pripravuje sa`, and `AUTO` locks it for an EDITOR until then. */
export const UPCOMING_WINDOW = { startsAt: dayShift(5), endsAt: dayShift(30) }

export type ProjectWithVersion = ProjectListItem & { version: ProjectVersion }

/** Creates a project as the ADMIN of `api` with one running version `v2.45` (`CURRENT_WINDOW`): every key needs a version to live in. */
export const createProjectWithVersion = async (api: APIRequestContext, label: string, languageTags: string[] = ['sk', 'en']): Promise<ProjectWithVersion> => {
	const project = await createProject(api, label, languageTags)
	const version = await createVersion(api, project.id, { name: 'v2.45', ...CURRENT_WINDOW })
	return { ...project, version }
}

export const createVersion = async (api: APIRequestContext, projectId: string, input: { name: string; startsAt: string; endsAt: string }) => {
	const response = await api.post(versionsApi(projectId), { data: input, headers: MUTATION_HEADERS })
	expect(response.status(), `POST ${versionsApi(projectId)}`).toBe(201)
	return (await response.json()) as ProjectVersion
}

export const updateVersion = async (
	api: APIRequestContext,
	projectId: string,
	versionId: string,
	input: Partial<{ name: string; startsAt: string; endsAt: string; lock: 'LOCKED' | 'UNLOCKED' }>,
) => {
	const response = await api.patch(`${versionsApi(projectId)}/${versionId}`, { data: input, headers: MUTATION_HEADERS })
	expect(response.status(), `PATCH ${versionsApi(projectId)}/${versionId}`).toBe(200)
	return (await response.json()) as ProjectVersion
}

export const deleteVersion = async (api: APIRequestContext, projectId: string, versionId: string) => {
	const response = await api.delete(`${versionsApi(projectId)}/${versionId}`, { data: {}, headers: MUTATION_HEADERS })
	expect(response.status(), `DELETE ${versionsApi(projectId)}/${versionId}`).toBe(204)
}

export type VersionDiffSummary = { previousVersion: { id: string; name: string } | null; added: number; changed: number; removed: number }

export const getVersionDiff = async (api: APIRequestContext, projectId: string, versionId: string) => {
	const response = await api.get(`${versionsApi(projectId)}/${versionId}/diff`)
	expect(response.status(), `GET ${versionsApi(projectId)}/${versionId}/diff`).toBe(200)
	return (await response.json()) as VersionDiffSummary
}

export const listVersions = async (api: APIRequestContext, projectId: string) => {
	const response = await api.get(versionsApi(projectId))
	expect(response.status(), `GET ${versionsApi(projectId)}`).toBe(200)
	return ((await response.json()) as { items: ProjectVersion[] }).items
}

export const getVersionsTable = (page: Page) => page.getByRole('table', { name: 'Zoznam verzií' })

export const getVersionRow = (page: Page, name: string) =>
	getVersionsTable(page)
		.getByRole('row')
		.filter({ has: page.getByText(name, { exact: true }) })

export const openVersionsPage = async (page: Page, projectSlug: string) => {
	await page.goto(versionsPath(projectSlug))
	await expect(page.getByRole('heading', { level: 1, name: 'Verzie' })).toBeVisible()
	await expect(getVersionsTable(page)).toHaveAttribute('aria-busy', 'false')
}

export const getDeleteVersionDialog = (page: Page) => page.getByRole('dialog', { name: 'Zmazať verziu' })

export const getVersionFormDialog = (page: Page, mode: 'create' | 'edit') =>
	page.getByRole('dialog', { name: mode === 'create' ? 'Vytvoriť verziu' : 'Upraviť verziu' })

export const fillVersionForm = async (dialog: ReturnType<Page['getByRole']>, input: { name?: string; startsAt?: string; endsAt?: string }) => {
	if (input.name !== undefined) {
		await dialog.getByRole('textbox', { name: 'Názov verzie' }).fill(input.name)
	}
	if (input.startsAt !== undefined) {
		await dialog.getByLabel('Začiatok').fill(input.startsAt)
	}
	if (input.endsAt !== undefined) {
		await dialog.getByLabel('Koniec').fill(input.endsAt)
	}
}
