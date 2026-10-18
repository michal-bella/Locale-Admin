import { type APIRequestContext, expect, type Page, test } from '@playwright/test'

import { MUTATION_HEADERS, readApiError } from '../support/api'
import { ANONYMOUS, expectLoggedInHome, loginViaUi } from '../support/auth'
import { type Language, listLanguages, newAdminApi, projectLanguagesApi } from '../support/languages'
import { getMainNavigation } from '../support/layout'
import { createProject, type ProjectListItem } from '../support/projects'
import { createEditor } from '../support/users'

const PAGE_HEADING = { level: 1, name: 'Jazyky' } as const
const RUSSIAN = { tag: 'ru', englishName: 'Russian', nativeName: 'русский', flagCode: 'ru' } as const
const RUSSIAN_OPTION = `${RUSSIAN.englishName} – ${RUSSIAN.nativeName} – ${RUSSIAN.tag}`

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const languagesPath = (projectId: string) => `/projects/${projectId}/languages`

const getTable = (page: Page) => page.getByRole('table', { name: 'Zoznam jazykov' })

// The second line of a row is "{nativeName} · {tag}"; the tag never changes, so rows are found by it.
const getRow = (page: Page, tag: string) =>
	getTable(page)
		.getByRole('row')
		.filter({ has: page.getByText(new RegExp(`· ${escapeRegExp(tag)}$`)) })

const getBaseBadge = (page: Page, tag: string) => getRow(page, tag).getByText('Základný', { exact: true })

const openLanguagesPage = async (page: Page, projectId: string) => {
	await page.goto(languagesPath(projectId))
	await expect(page.getByRole('heading', PAGE_HEADING)).toBeVisible()
	await expect(getTable(page)).toHaveAttribute('aria-busy', 'false')
}

const openRowMenu = async (page: Page, englishName: string) => {
	await page.getByRole('button', { name: `Akcie pre jazyk ${englishName}`, exact: true }).click()
	await expect(page.getByRole('menu')).toBeVisible()
}

// Mantine marks a disabled option only with `data-combobox-disabled` (no `aria-disabled`), so toBeDisabled() cannot see it.
const expectOptionDisabled = async (page: Page, name: string) => {
	await expect(page.getByRole('option', { name })).toHaveAttribute('data-combobox-disabled', 'true')
}

const waitForLanguagesResponse = (page: Page, projectId: string, method: string) =>
	page.waitForResponse((response) => response.url().includes(projectLanguagesApi(projectId)) && response.request().method() === method)

test.describe('ADMIN in a project', () => {
	// The tests build on each other inside one test project of this browser.
	test.describe.configure({ mode: 'serial' })

	let api: APIRequestContext
	let project: ProjectListItem

	test.beforeAll(async ({ playwright }) => {
		api = await newAdminApi(playwright.request)
		project = await createProject(api, 'languages', ['sk', 'en'])
	})

	test.afterAll(async () => {
		await api?.dispose()
	})

	test('opens Jazyky from the project sidebar and sees sk as the base and en', async ({ page }) => {
		await page.goto(`/projects/${project.id}/settings`)
		const item = getMainNavigation(page).getByRole('list', { name: project.name }).getByRole('link', { name: 'Jazyky' })
		await expect(item).toHaveAttribute('href', languagesPath(project.id))
		await item.click()
		await expect(page).toHaveURL(languagesPath(project.id))
		await expect(page.getByRole('heading', PAGE_HEADING)).toBeVisible()
		await expect(item).toHaveAttribute('aria-current', 'page')

		await expect(getTable(page).getByRole('row')).toHaveCount(3)
		await expect(getRow(page, 'sk')).toContainText('Slovak')
		await expect(getRow(page, 'en')).toContainText('English')
		await expect(getBaseBadge(page, 'sk')).toBeVisible()
		await expect(getTable(page).getByText('Základný', { exact: true })).toHaveCount(1)
	})

	test('adds a language from the catalog: the row appears and the language is disabled in the select', async ({ page }) => {
		await openLanguagesPage(page, project.id)

		await page.getByRole('button', { name: 'Pridať jazyk', exact: true }).click()
		const dialog = page.getByRole('dialog', { name: 'Pridať jazyk' })
		const select = dialog.getByLabel('Jazyk')
		await select.click()
		await expectOptionDisabled(page, 'Slovak – slovenčina – sk')
		await select.fill(RUSSIAN.englishName)
		await page.getByRole('option', { name: RUSSIAN_OPTION }).click()
		const created = waitForLanguagesResponse(page, project.id, 'POST')
		await dialog.getByRole('button', { name: 'Pridať', exact: true }).click()
		expect((await created).status()).toBe(201)

		await expect(page.getByText(`Jazyk ${RUSSIAN.englishName} bol pridaný.`)).toBeVisible()
		await expect(dialog).toBeHidden()
		const row = getRow(page, RUSSIAN.tag)
		await expect(row).toContainText(`${RUSSIAN.nativeName} · ${RUSSIAN.tag}`)
		await expect(row.locator(`svg[data-flag="${RUSSIAN.flagCode}"]`)).toBeVisible()
		await expect(getBaseBadge(page, RUSSIAN.tag)).toHaveCount(0)
		expect((await listLanguages(api, project.id)).map(({ tag }) => tag)).toEqual(['sk', 'en', 'ru'])
	})

	test('Odobrať is disabled for the base language; another one is removed after confirmation', async ({ page }) => {
		await openLanguagesPage(page, project.id)

		await openRowMenu(page, 'Slovak')
		await expect(page.getByRole('menuitem', { name: 'Odobrať' })).toBeDisabled()
		await page.keyboard.press('Escape')
		await expect(page.getByRole('menu')).toBeHidden()

		await openRowMenu(page, RUSSIAN.englishName)
		await page.getByRole('menuitem', { name: 'Odobrať' }).click()
		const confirm = page.getByRole('dialog', { name: 'Odobrať jazyk' })
		await expect(confirm).toContainText(`Naozaj chcete odobrať jazyk ${RUSSIAN.englishName} (${RUSSIAN.tag}) z projektu?`)
		await confirm.getByRole('button', { name: 'Zrušiť' }).click()
		await expect(confirm).toBeHidden()
		await expect(getRow(page, RUSSIAN.tag)).toHaveCount(1)

		await openRowMenu(page, RUSSIAN.englishName)
		await page.getByRole('menuitem', { name: 'Odobrať' }).click()
		const deleted = waitForLanguagesResponse(page, project.id, 'DELETE')
		await confirm.getByRole('button', { name: 'Odobrať' }).click()
		expect((await deleted).status()).toBe(204)

		await expect(page.getByText(`Jazyk ${RUSSIAN.englishName} bol odobraný z projektu.`)).toBeVisible()
		await expect(getRow(page, RUSSIAN.tag)).toHaveCount(0)
	})

	test('the languages of another project stay untouched', async () => {
		const other = await createProject(api, 'languages-other', ['hu'])
		expect((await listLanguages(api, other.id)).map(({ tag, isBase }) => ({ tag, isBase }))).toEqual([{ tag: 'hu', isBase: true }])
		expect((await listLanguages(api, project.id)).map(({ tag }) => tag)).toEqual(['sk', 'en'])
	})
})

test.describe('member', () => {
	test.use({ storageState: ANONYMOUS })

	test('adds and removes languages in an own project but gets 404 for a foreign one', async ({ page, playwright, baseURL }) => {
		const editor = await createEditor(playwright.request, baseURL)
		await loginViaUi(page, editor)
		await expectLoggedInHome(page)

		const added = await page.request.post(projectLanguagesApi(editor.projectId), { data: { tag: 'hr' }, headers: MUTATION_HEADERS })
		expect(added.status()).toBe(201)
		const { id } = (await added.json()) as Language
		const removed = await page.request.delete(`${projectLanguagesApi(editor.projectId)}/${id}`, { data: {}, headers: MUTATION_HEADERS })
		expect(removed.status()).toBe(204)

		const admin = await newAdminApi(playwright.request)
		const foreign = await createProject(admin, 'languages-foreign')
		await admin.dispose()
		const response = await page.request.get(projectLanguagesApi(foreign.id))
		expect(response.status()).toBe(404)
		expect((await readApiError(response)).code).toBe('NOT_FOUND')
	})
})

test('the former admin page /languages no longer exists', async ({ page }) => {
	await page.goto('/languages')
	await expect(page.getByRole('heading', { level: 1, name: 'Stránka sa nenašla' })).toBeVisible()
})

test.describe('anonymous', () => {
	test.use({ storageState: ANONYMOUS })

	test('the Jazyky page of a project redirects to /login', async ({ page, playwright }) => {
		const admin = await newAdminApi(playwright.request)
		const project = await createProject(admin, 'languages-anonymous')
		await admin.dispose()

		await page.goto(languagesPath(project.id))
		await expect(page).toHaveURL('/login')
	})
})
