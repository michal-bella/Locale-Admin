import { expect, type Page, test } from '@playwright/test'

import { readApiError } from '../support/api'
import { STORAGE_STATE } from '../support/auth'
import { newAdminApi } from '../support/languages'
import { getMainNavigation } from '../support/layout'
import { createProject, getProjectSettings, projectSettingsApi, type ProjectListItem } from '../support/projects'
import { addMember, createMember } from '../support/users'

const ADMIN_PROJECTS_PATH = '/admin/projects'
const ADMIN_PROJECTS_API = '/api/admin/projects'

const settingsPath = (projectSlug: string) => `/projects/${projectSlug}/settings`

const getTable = (page: Page) => page.getByRole('table', { name: 'Zoznam projektov' })

const openAdminProjectsPage = async (page: Page) => {
	await page.goto(ADMIN_PROJECTS_PATH)
	await expect(getTable(page)).toHaveAttribute('aria-busy', 'false')
	return getTable(page)
}

/** The edited slug contains the original one, so the row is matched by the exact slug cell. */
const getRow = (page: Page, slug: string) =>
	getTable(page)
		.getByRole('row')
		.filter({ has: page.getByRole('cell', { name: slug, exact: true }) })

const formatCreatedAt = (createdAt: string) =>
	new Intl.DateTimeFormat('sk-SK', { day: 'numeric', month: 'numeric', year: 'numeric' }).format(new Date(createdAt))

/** Sets a marker on `window` that a full reload would drop. */
const markNoReload = (page: Page) => page.evaluate(() => Object.assign(window, { e2eNoReload: true }))

const expectNoReload = async (page: Page) => expect(await page.evaluate(() => 'e2eNoReload' in window)).toBe(true)

const openEditModal = async (page: Page, project: Pick<ProjectListItem, 'name'>) => {
	await page.getByRole('button', { name: `Upraviť projekt ${project.name}`, exact: true }).click()
	const dialog = page.getByRole('dialog', { name: 'Upraviť projekt' })
	await expect(dialog.getByRole('button', { name: 'Uložiť zmeny' })).toBeVisible()
	return dialog
}

const openDeleteModal = async (page: Page, project: Pick<ProjectListItem, 'name'>) => {
	await page.getByRole('button', { name: `Zmazať projekt ${project.name}`, exact: true }).click()
	const dialog = page.getByRole('dialog', { name: 'Zmazať projekt' })
	await expect(dialog).toBeVisible()
	return dialog
}

const waitForSettingsPatch = (page: Page, projectId: string) =>
	page.waitForResponse((response) => response.url().endsWith(projectSettingsApi(projectId)) && response.request().method() === 'PATCH')

test.describe('ADMIN', () => {
	test('opens Projekty from the sidebar and sees the project with slug, base language and counts', async ({ page, playwright, baseURL }) => {
		const api = await newAdminApi(playwright.request)
		const project = await createProject(api, 'admin-list', ['en', 'sk', 'de-AT'])
		await addMember(api, project.id, (await createMember(playwright.request, baseURL)).id)
		const { projects } = (await (await api.get(ADMIN_PROJECTS_API)).json()) as { projects: { id: string; createdAt: string }[] }
		const createdAt = projects.find(({ id }) => id === project.id)!.createdAt
		await api.dispose()

		await page.goto('/profile')
		const navigation = getMainNavigation(page)
		const projectsLink = navigation.getByRole('link', { name: 'Projekty', exact: true })
		const usersLink = navigation.getByRole('link', { name: 'Používatelia', exact: true })
		expect((await projectsLink.boundingBox())!.y).toBeLessThan((await usersLink.boundingBox())!.y)
		await projectsLink.click()

		await expect(page).toHaveURL(ADMIN_PROJECTS_PATH)
		await expect(page.getByRole('heading', { level: 1, name: 'Projekty' })).toBeVisible()
		await expect(projectsLink).toHaveAttribute('aria-current', 'page')
		await expect(getTable(page)).toHaveAttribute('aria-busy', 'false')
		await expect(getTable(page).getByRole('columnheader')).toHaveText(['Projekt', 'Slug', 'Základný jazyk', 'Jazyky', 'Členovia', 'Vytvorený', 'Akcie'])

		const cells = getRow(page, project.slug).getByRole('cell')
		await expect(cells.nth(0)).toHaveText(new RegExp(`${project.name}$`))
		await expect(cells.nth(1)).toHaveText(project.slug)
		await expect(cells.nth(2)).toHaveText('English')
		await expect(cells.nth(3)).toHaveText('3')
		await expect(cells.nth(4)).toHaveText('2')
		await expect(cells.nth(5)).toHaveText(formatCreatedAt(createdAt))
		await expect(cells.nth(6).getByRole('button')).toHaveCount(2)
		await expect(cells.nth(6).getByRole('button', { name: `Upraviť projekt ${project.name}`, exact: true })).toBeVisible()
		await expect(cells.nth(6).getByRole('button', { name: `Zmazať projekt ${project.name}`, exact: true })).toBeVisible()
		await expect(cells.nth(6).getByRole('link')).toHaveCount(1)
		await expect(cells.nth(6).getByRole('link', { name: `Otvoriť projekt ${project.name}`, exact: true })).toHaveAttribute(
			'href',
			settingsPath(project.slug),
		)
	})

	test('Nový projekt opens the create project modal', async ({ page }) => {
		await openAdminProjectsPage(page)
		await page.getByRole('button', { name: 'Nový projekt' }).click()
		const dialog = page.getByRole('dialog', { name: 'Nový projekt' })
		await expect(dialog.getByLabel('Názov projektu', { exact: true })).toBeVisible()
		await dialog.getByRole('button', { name: 'Zrušiť' }).click()
		await expect(dialog).toBeHidden()
	})

	test('edits name and slug in the modal; the row updates without a reload and the URL stays', async ({ page, playwright }) => {
		const api = await newAdminApi(playwright.request)
		const project = await createProject(api, 'admin-edit')
		const edited = { name: `${project.name} upravený`, slug: `${project.slug}-x` }

		await openAdminProjectsPage(page)
		await markNoReload(page)
		const dialog = await openEditModal(page, project)
		await expect(dialog.getByLabel('Názov projektu', { exact: true })).toBeFocused()
		await expect(dialog).toContainText(project.name)
		await expect(dialog.getByRole('button', { name: 'Opustiť projekt' })).toHaveCount(0)
		await expect(dialog.getByLabel('Názov projektu', { exact: true })).toHaveValue(project.name)
		await expect(dialog.getByLabel('Slug projektu', { exact: true })).toHaveValue(project.slug)
		await expect(dialog.getByLabel('Primárna farba', { exact: true })).toHaveValue(project.primaryColor)
		await expect(dialog.getByLabel('Základný jazyk', { exact: true })).toHaveValue('Slovak (sk)')
		await expect(dialog.getByRole('switch', { name: /^Chrániť výrazy/ })).toBeVisible()

		await dialog.getByLabel('Názov projektu', { exact: true }).fill(edited.name)
		await dialog.getByLabel('Slug projektu', { exact: true }).fill(edited.slug)
		const patched = waitForSettingsPatch(page, project.id)
		await dialog.getByRole('button', { name: 'Uložiť zmeny' }).click()
		expect((await patched).status()).toBe(200)

		await expect(dialog).toBeHidden()
		await expect(getRow(page, edited.slug).getByRole('cell').nth(0)).toHaveText(new RegExp(`${edited.name}$`))
		await expect(getRow(page, project.slug)).toHaveCount(0)
		await expect(page).toHaveURL(ADMIN_PROJECTS_PATH)
		await expectNoReload(page)
		expect(await getProjectSettings(api, project.id)).toMatchObject(edited)
		await api.dispose()
	})

	test('Zrušiť discards the changes in the edit modal', async ({ page, playwright }) => {
		const api = await newAdminApi(playwright.request)
		const project = await createProject(api, 'admin-cancel')
		await api.dispose()
		const patches: string[] = []
		page.on('request', (request) => {
			if (request.method() === 'PATCH' && request.url().endsWith(projectSettingsApi(project.id))) {
				patches.push(request.url())
			}
		})

		await openAdminProjectsPage(page)
		let dialog = await openEditModal(page, project)
		await dialog.getByLabel('Názov projektu', { exact: true }).fill(`${project.name} zahodený`)
		await dialog.getByRole('button', { name: 'Zrušiť' }).click()
		await expect(dialog).toBeHidden()

		dialog = await openEditModal(page, project)
		await expect(dialog.getByLabel('Názov projektu', { exact: true })).toBeFocused()
		await expect(dialog.getByLabel('Názov projektu', { exact: true })).toHaveValue(project.name)
		expect(patches).toEqual([])
	})

	test('a slug of another project shows 409 at the slug field and the modal stays open', async ({ page, playwright }) => {
		const api = await newAdminApi(playwright.request)
		const project = await createProject(api, 'admin-taken')
		const other = await createProject(api, 'admin-taken-other')

		await openAdminProjectsPage(page)
		const dialog = await openEditModal(page, project)
		const slug = dialog.getByLabel('Slug projektu', { exact: true })
		await slug.fill(other.slug)
		const patched = waitForSettingsPatch(page, project.id)
		await dialog.getByRole('button', { name: 'Uložiť zmeny' }).click()
		expect((await patched).status()).toBe(409)

		await expect(slug).toHaveAttribute('aria-invalid', 'true')
		await expect(slug).toHaveAccessibleDescription(/Projekt s týmto slugom už existuje\./)
		await expect(dialog).toBeVisible()
		await expect(getRow(page, project.slug)).toHaveCount(1)
		expect((await getProjectSettings(api, project.id)).slug).toBe(project.slug)
		await api.dispose()
	})

	test('deletes a project after retyping its slug; the row disappears without a reload', async ({ page, playwright }) => {
		const api = await newAdminApi(playwright.request)
		const project = await createProject(api, 'admin-delete')
		await api.dispose()

		await openAdminProjectsPage(page)
		await markNoReload(page)
		const dialog = await openDeleteModal(page, project)
		const confirmation = dialog.getByLabel(`Pre potvrdenie napíšte slug projektu ${project.slug}`, { exact: true })
		const confirm = dialog.getByRole('button', { name: 'Zmazať projekt' })
		await expect(confirmation).toBeFocused()
		await expect(confirm).toBeDisabled()

		await confirmation.fill(project.slug.slice(0, -1))
		await expect(confirm).toBeDisabled()
		await confirmation.fill(`${project.slug} `)
		await expect(confirm).toBeDisabled()
		await confirmation.fill(project.slug.toUpperCase())
		await expect(confirm).toBeDisabled()
		await confirmation.fill(project.slug)
		await expect(confirm).toBeEnabled()

		const deleted = page.waitForResponse(
			(response) => response.url().endsWith(`${ADMIN_PROJECTS_API}/${project.id}`) && response.request().method() === 'DELETE',
		)
		await confirm.click()
		expect((await deleted).status()).toBe(204)
		await expect(page.getByText(`Projekt ${project.name} bol zmazaný.`)).toBeVisible()
		await expect(dialog).toBeHidden()
		await expect(getRow(page, project.slug)).toHaveCount(0)
		await expectNoReload(page)

		await page.goto(settingsPath(project.slug))
		await expect(page.getByRole('heading', { level: 1, name: 'Projekt sa nenašiel' })).toBeVisible()
	})

	test('Zrušiť in the delete modal keeps the project', async ({ page, playwright }) => {
		const api = await newAdminApi(playwright.request)
		const project = await createProject(api, 'admin-keep')

		await openAdminProjectsPage(page)
		const dialog = await openDeleteModal(page, project)
		await dialog.getByLabel(`Pre potvrdenie napíšte slug projektu ${project.slug}`, { exact: true }).fill(project.slug)
		await dialog.getByRole('button', { name: 'Zrušiť' }).click()
		await expect(dialog).toBeHidden()
		await expect(getRow(page, project.slug)).toHaveCount(1)
		expect((await getProjectSettings(api, project.id)).slug).toBe(project.slug)
		await api.dispose()
	})

	test('Otvoriť projekt navigates to the project settings', async ({ page, playwright }) => {
		const api = await newAdminApi(playwright.request)
		const project = await createProject(api, 'admin-open')
		await api.dispose()

		await openAdminProjectsPage(page)
		await page.getByRole('link', { name: `Otvoriť projekt ${project.name}`, exact: true }).click()
		await expect(page).toHaveURL(settingsPath(project.slug))
		await expect(page.getByRole('heading', { level: 1, name: 'Nastavenia projektu' })).toBeVisible()
		await expect(page.getByLabel('Názov projektu', { exact: true })).toHaveValue(project.name)
	})
})

test.describe('EDITOR', () => {
	test.use({ storageState: STORAGE_STATE.EDITOR })

	test('has no Projekty item in the sidebar', async ({ page }) => {
		await page.goto('/profile')
		await expect(getMainNavigation(page)).toBeAttached()
		await expect(getMainNavigation(page).getByRole('link', { name: 'Projekty', exact: true })).toHaveCount(0)
		await expect(page.getByRole('link', { name: 'Používatelia' })).toHaveCount(0)
	})

	test('/admin/projects shows the 403 page and the API returns 403', async ({ page }) => {
		await page.goto(ADMIN_PROJECTS_PATH)
		await expect(page.getByRole('heading', { level: 1, name: 'Prístup zamietnutý' })).toBeVisible()
		await expect(page).toHaveURL(ADMIN_PROJECTS_PATH)
		await expect(getTable(page)).toHaveCount(0)
		await expect(page.getByRole('button', { name: 'Nový projekt' })).toHaveCount(0)

		const list = await page.request.get(ADMIN_PROJECTS_API)
		expect(list.status()).toBe(403)
		expect((await readApiError(list)).code).toBe('FORBIDDEN')
	})
})
