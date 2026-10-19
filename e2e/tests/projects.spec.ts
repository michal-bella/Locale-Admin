import { expect, type Locator, type Page, test } from '@playwright/test'

import { MUTATION_HEADERS } from '../support/api'
import { ANONYMOUS, expectLoggedInHome, loginViaUi } from '../support/auth'
import { newAdminApi } from '../support/languages'
import { createProject, listProjects, newTestProjectInput } from '../support/projects'
import { addMember, createEditor, createMember } from '../support/users'

/** Mantine MultiSelect also renders a hidden input with the same label; the visible one opens the options. */
const pickLanguages = async (page: Page, dialog: Locator, ...options: string[]) => {
	const input = dialog.getByLabel('Jazyky', { exact: true }).and(dialog.locator('[data-type="visible"]'))
	for (const option of options) {
		await input.click()
		await page.getByRole('option', { name: option }).click()
	}
}

const getList = (page: Page) => page.getByRole('list', { name: 'Zoznam projektov' })

const leaveFromList = async (page: Page, name: string) => {
	await page.getByRole('button', { name: `Opustiť projekt ${name}`, exact: true }).click()
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
		await expect(getList(page).getByRole('link', { name: own!.name, exact: true })).toHaveAttribute('href', `/projects/${editor.projectSlug}/translations`)
		await expect(getList(page).getByRole('link', { name: `Nastavenia projektu ${own!.name}`, exact: true })).toHaveAttribute(
			'href',
			`/projects/${editor.projectSlug}/settings`,
		)

		const { name, slug } = newTestProjectInput('ui')
		await page.getByRole('button', { name: 'Nový projekt' }).click()
		const dialog = page.getByRole('dialog', { name: 'Nový projekt' })
		await dialog.getByLabel('Názov projektu', { exact: true }).fill(name)
		// The slug follows the name until it is edited.
		await expect(dialog.getByLabel('Slug projektu', { exact: true })).toHaveValue(name.toLowerCase().replaceAll(' ', '-'))
		await dialog.getByLabel('Slug projektu', { exact: true }).fill(slug)
		// The first chosen language becomes the base.
		await pickLanguages(page, dialog, 'English – English – en', 'Slovak – slovenčina – sk')
		const created = page.waitForResponse((response) => response.url().endsWith('/api/projects') && response.request().method() === 'POST')
		await dialog.getByRole('button', { name: 'Vytvoriť projekt' }).click()
		const response = await created
		expect(response.status()).toBe(201)
		expect(response.request().postDataJSON()).toMatchObject({ languageTags: ['en', 'sk'] })

		await expect(page.getByText(`Projekt ${name} bol vytvorený.`)).toBeVisible()
		await expect(page).toHaveURL(`/projects/${slug}/settings`)
		await expect(page.getByLabel('Názov projektu', { exact: true })).toHaveValue(name)
		await expect(page.getByRole('navigation', { name: 'Hlavná navigácia' }).getByRole('list', { name })).toBeVisible()

		await page
			.getByRole('complementary')
			.getByRole('button', { name: `Prepnúť projekt, aktuálny ${name}` })
			.click()
		await page.getByRole('menu').getByRole('menuitem', { name: 'Všetky projekty' }).click()
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
		// Enter after typing picks the first match and does not submit the form yet.
		const languages = dialog.getByLabel('Jazyky', { exact: true }).and(dialog.locator('[data-type="visible"]'))
		await languages.fill('slov')
		await expect(page.getByRole('option', { name: 'Slovak – slovenčina – sk' })).toBeVisible()
		await languages.press('Enter')
		await expect(dialog.getByText('Slovak – slovenčina – sk')).toBeVisible()
		await expect(dialog.getByText('Toto pole je povinné.')).toHaveCount(0)
		// The multi-select keeps its dropdown open after Enter, and the dropdown covers the submit button.
		await dialog.getByRole('heading', { name: 'Nový projekt' }).click()
		await expect(page.getByRole('option', { name: 'Slovak – slovenčina – sk' })).toBeHidden()
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
		await expect(page.getByText('Projekt musí mať aspoň jedného člena.')).toBeVisible()
		await expect(dialog).toBeVisible()
		await dialog.getByRole('button', { name: 'Zrušiť' }).click()
		await expect(dialog).toBeHidden()

		const admin = await newAdminApi(playwright.request)
		await addMember(admin, project.id, (await createMember(playwright.request, baseURL)).id)
		await admin.dispose()

		await leaveFromList(page, project.name)
		await expect(page.getByText(`Opustili ste projekt ${project.name}.`)).toBeVisible()
		await expect(getList(page).getByRole('link', { name: project.name, exact: true })).toHaveCount(0)
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
		await expect(page.getByRole('button', { name: `Opustiť projekt ${foreign.name}`, exact: true })).toHaveCount(0)
		await page.getByRole('link', { name: `Nastavenia projektu ${foreign.name}`, exact: true }).click()
		await expect(page).toHaveURL(`/projects/${foreign.slug}/settings`)
		await expect(page.getByRole('button', { name: 'Uložiť zmeny' })).toBeVisible()
		await expect(page.getByRole('button', { name: 'Opustiť projekt' })).toHaveCount(0)
	})
})
