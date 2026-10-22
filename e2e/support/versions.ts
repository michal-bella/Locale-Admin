import { type APIRequestContext, expect, type Page } from '@playwright/test'

import { MUTATION_HEADERS } from './api'

export type ProjectVersion = {
	id: string
	name: string
	startsAt: string
	endsAt: string
	lock: 'AUTO' | 'LOCKED' | 'UNLOCKED'
	isLocked: boolean
	state: 'UPCOMING' | 'ACTIVE' | 'LOCKED'
	isCurrent: boolean
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

/** A version running today: started 2 days ago, 12 days left. */
export const CURRENT_WINDOW = { startsAt: dayShift(-2), endsAt: dayShift(12) }

/** A version whose end is 20 days back, so `AUTO` locks it. */
export const PAST_WINDOW = { startsAt: dayShift(-40), endsAt: dayShift(-20) }

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
