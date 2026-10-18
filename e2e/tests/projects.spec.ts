import { expect, type Page, test } from '@playwright/test'

import { MUTATION_HEADERS } from '../support/api'
import { ANONYMOUS, expectLoggedInHome, loginViaUi } from '../support/auth'
import { newAdminApi } from '../support/languages'
import { createProject, listProjects, newTestProjectInput, projectMembersApi } from '../support/projects'
import { createEditor, newTestUserCredentials } from '../support/users'

const getList = (page: Page) => page.getByRole('list', { name: 'Zoznam projektov' })

const openActions = async (page: Page, name: string) => {
	await page.getByRole('button', { name: `Akcie projektu ${name}`, exact: true }).click()
	const menu = page.getByRole('menu')
	await expect(menu).toBeVisible()
	return menu
}

const leaveFromList = async (page: Page, name: string) => {
	await (await openActions(page, name)).getByRole('menuitem', { name: 'Opustiť projekt' }).click()
	const dialog = page.getByRole('dialog', { name: 'Opustiť projekt' })
	await expect(dialog).toContainText(`Naozaj chcete opustiť projekt ${name}?`)
	await dialog.getByRole('button', { name: 'Opustiť projekt' }).click()
	return dialog
}

test.describe('member', () => {
	test.use({ storageState: ANONYMOUS })

	test('sees only own projects, creates one and lands in its settings', async ({ page, playwright, baseURL }) => {
		const editor = await createEditor(playwright.request, baseURL)
		await loginViaUi(page, editor)
		await expectLoggedInHome(page)
		await expect(page.getByRole('heading', { level: 1, name: 'Projekty' })).toBeVisible()
		await expect(page.getByRole('complementary')).toHaveCount(0)
		const [own] = await listProjects(page.request)
		await expect(getList(page).getByRole('listitem')).toHaveCount(1)
		await expect(getList(page).getByRole('link', { name: own!.name })).toHaveAttribute('href', `/projects/${editor.projectId}/settings`)

		const { name, slug } = newTestProjectInput('ui')
		await page.getByRole('button', { name: 'Nový projekt' }).click()
		const dialog = page.getByRole('dialog', { name: 'Nový projekt' })
		await dialog.getByLabel('Názov projektu', { exact: true }).fill(name)
		// The slug follows the name until it is edited.
		await expect(dialog.getByLabel('Slug projektu', { exact: true })).toHaveValue(name.toLowerCase().replaceAll(' ', '-'))
		await dialog.getByLabel('Slug projektu', { exact: true }).fill(slug)
		const created = page.waitForResponse((response) => response.url().endsWith('/api/projects') && response.request().method() === 'POST')
		await dialog.getByRole('button', { name: 'Vytvoriť projekt' }).click()
		expect((await created).status()).toBe(201)

		await expect(page.getByText(`Projekt ${name} bol vytvorený.`)).toBeVisible()
		await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+\/settings$/)
		await expect(page.getByLabel('Názov projektu', { exact: true })).toHaveValue(name)
		await expect(page.getByRole('navigation', { name: 'Hlavná navigácia' }).getByRole('list', { name })).toBeVisible()

		await page.getByRole('link', { name: 'Všetky projekty' }).click()
		await expect(getList(page).getByRole('listitem')).toHaveCount(2)
	})

	test('a taken slug shows 409 at the slug field', async ({ page, playwright, baseURL }) => {
		const api = await newAdminApi(playwright.request)
		const taken = await createProject(api, 'taken-ui')
		await api.dispose()
		await loginViaUi(page, await createEditor(playwright.request, baseURL))
		await expectLoggedInHome(page)

		await page.getByRole('button', { name: 'Nový projekt' }).click()
		const dialog = page.getByRole('dialog', { name: 'Nový projekt' })
		await dialog.getByLabel('Názov projektu', { exact: true }).fill('Iný projekt')
		const slug = dialog.getByLabel('Slug projektu', { exact: true })
		await slug.fill(taken.slug)
		await dialog.getByRole('button', { name: 'Vytvoriť projekt' }).click()

		await expect(slug).toHaveAttribute('aria-invalid', 'true')
		await expect(slug).toHaveAccessibleDescription(/Projekt s týmto slugom už existuje\./)
		await expect(dialog).toBeVisible()
	})

	test('the last member cannot leave; after another member joins, leaving removes the project from the list', async ({ page, playwright, baseURL }) => {
		const editor = await createEditor(playwright.request, baseURL)
		await loginViaUi(page, editor)
		await expectLoggedInHome(page)
		const project = await createProject(page.request, 'leave')
		await page.reload()

		const dialog = await leaveFromList(page, project.name)
		await expect(page.getByText('Ste posledný člen projektu, nemôžete ho opustiť.')).toBeVisible()
		await expect(dialog).toBeVisible()
		await dialog.getByRole('button', { name: 'Zrušiť' }).click()
		await expect(dialog).toBeHidden()

		const added = await page.request.post(projectMembersApi(project.id), { data: newTestUserCredentials(), headers: MUTATION_HEADERS })
		expect(added.status()).toBe(201)

		await leaveFromList(page, project.name)
		await expect(page.getByText(`Opustili ste projekt ${project.name}.`)).toBeVisible()
		await expect(getList(page).getByRole('link', { name: project.name })).toHaveCount(0)
		await expect(getList(page).getByRole('listitem')).toHaveCount(1)
	})
})

test.describe('ADMIN', () => {
	test('sees a project it is not a member of, without Opustiť projekt', async ({ page, playwright, baseURL }) => {
		const editor = await createEditor(playwright.request, baseURL)
		const editorApi = await playwright.request.newContext({ baseURL, storageState: ANONYMOUS })
		const login = await editorApi.post('/api/auth/login', { data: { email: editor.email, password: editor.password }, headers: MUTATION_HEADERS })
		expect(login.status()).toBe(200)
		const foreign = await createProject(editorApi, 'foreign-ui')
		await editorApi.dispose()

		await page.goto('/')
		const menu = await openActions(page, foreign.name)
		await expect(menu.getByRole('menuitem')).toHaveText(['Nastavenia'])
		await menu.getByRole('menuitem', { name: 'Nastavenia' }).click()
		await expect(page).toHaveURL(`/projects/${foreign.id}/settings`)
		await expect(page.getByRole('button', { name: 'Uložiť zmeny' })).toBeVisible()
		await expect(page.getByRole('button', { name: 'Opustiť projekt' })).toHaveCount(0)
	})
})
