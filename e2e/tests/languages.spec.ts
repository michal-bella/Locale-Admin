import { type APIRequestContext, expect, type Page, test } from '@playwright/test'

import { MUTATION_HEADERS, readApiError } from '../support/api'
import { ANONYMOUS, expectLoggedInHome, loginViaUi } from '../support/auth'
import { type Language, listLanguages, newAdminApi, projectLanguagesApi } from '../support/languages'
import { getMainNavigation } from '../support/layout'
import { createProject, type ProjectListItem } from '../support/projects'
import { createEditor } from '../support/users'

const PAGE_HEADING = { level: 1, name: 'Jazyky' } as const
// `name` is the capitalized name in the app language (languageNames in sk.json) the table shows; the toasts and the confirmation use it lowercase.
const RUSSIAN = { tag: 'ru', englishName: 'Russian', name: 'Ruština', nativeName: 'русский', flagCode: 'ru' } as const
const RUSSIAN_OPTION = `${RUSSIAN.englishName} – ${RUSSIAN.nativeName} – ${RUSSIAN.tag}`

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const languagesPath = (projectSlug: string) => `/projects/${projectSlug}/languages`

const getTable = (page: Page) => page.getByRole('table', { name: 'Zoznam jazykov' })

// The second line of a row is "{nativeName} · {tag}"; the tag never changes, so rows are found by it.
const getRow = (page: Page, tag: string) =>
	getTable(page)
		.getByRole('row')
		.filter({ has: page.getByText(new RegExp(`· ${escapeRegExp(tag)}$`)) })

const getBaseBadge = (page: Page, tag: string) => getRow(page, tag).getByText('Základný', { exact: true })

const openLanguagesPage = async (page: Page, projectSlug: string) => {
	await page.goto(languagesPath(projectSlug))
	await expect(page.getByRole('heading', PAGE_HEADING)).toBeVisible()
	await expect(getTable(page)).toHaveAttribute('aria-busy', 'false')
}

const getRemoveButton = (page: Page, name: string) => page.getByRole('button', { name: `Odobrať jazyk ${name}`, exact: true })

const getGrip = (page: Page, name: string) => page.getByRole('button', { name: `Presunúť jazyk ${name}`, exact: true })

const expectRowOrder = async (page: Page, tags: string[]) => {
	await expect(getTable(page).locator('tbody tr')).toHaveText(tags.map((tag) => new RegExp(`· ${escapeRegExp(tag)}(?![a-z-])`)))
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
		await page.goto(`/projects/${project.slug}/settings`)
		const item = getMainNavigation(page).getByRole('list', { name: project.name }).getByRole('link', { name: 'Jazyky' })
		await expect(item).toHaveAttribute('href', languagesPath(project.slug))
		await item.click()
		await expect(page).toHaveURL(languagesPath(project.slug))
		await expect(page.getByRole('heading', PAGE_HEADING)).toBeVisible()
		await expect(item).toHaveAttribute('aria-current', 'page')

		await expect(getTable(page).getByRole('row')).toHaveCount(3)
		await expect(getRow(page, 'sk')).toContainText('Slovenčina')
		await expect(getRow(page, 'en')).toContainText('Angličtina')
		await expect(getBaseBadge(page, 'sk')).toBeVisible()
		await expect(getTable(page).getByText('Základný', { exact: true })).toHaveCount(1)
	})

	test('adds a language from the catalog: the row appears and the language is disabled in the select', async ({ page }) => {
		await openLanguagesPage(page, project.slug)

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

		await expect(page.getByText(`Jazyk ${RUSSIAN.name.toLowerCase()} bol pridaný.`)).toBeVisible()
		await expect(dialog).toBeHidden()
		const row = getRow(page, RUSSIAN.tag)
		await expect(row).toContainText(`${RUSSIAN.nativeName} · ${RUSSIAN.tag}`)
		await expect(row.locator(`svg[data-flag="${RUSSIAN.flagCode}"]`)).toBeVisible()
		await expect(getBaseBadge(page, RUSSIAN.tag)).toHaveCount(0)
		expect((await listLanguages(api, project.id)).map(({ tag }) => tag)).toEqual(['sk', 'en', 'ru'])
	})

	test('Odobrať is disabled for the base language; another one is removed after confirmation', async ({ page }) => {
		await openLanguagesPage(page, project.slug)

		await expect(getRemoveButton(page, 'Slovenčina')).toBeDisabled()

		await getRemoveButton(page, RUSSIAN.name).click()
		const confirm = page.getByRole('dialog', { name: 'Odobrať jazyk' })
		await expect(confirm).toContainText(`Naozaj chcete odobrať jazyk ${RUSSIAN.name.toLowerCase()} (${RUSSIAN.tag}) z projektu?`)
		await confirm.getByRole('button', { name: 'Zrušiť' }).click()
		await expect(confirm).toBeHidden()
		await expect(getRow(page, RUSSIAN.tag)).toHaveCount(1)

		await getRemoveButton(page, RUSSIAN.name).click()
		const deleted = waitForLanguagesResponse(page, project.id, 'DELETE')
		await confirm.getByRole('button', { name: 'Odobrať' }).click()
		expect((await deleted).status()).toBe(204)

		await expect(page.getByText(`Jazyk ${RUSSIAN.name.toLowerCase()} bol odobraný z projektu.`)).toBeVisible()
		await expect(getRow(page, RUSSIAN.tag)).toHaveCount(0)
	})

	test('the languages of another project stay untouched', async () => {
		const other = await createProject(api, 'languages-other', ['hu'])
		expect((await listLanguages(api, other.id)).map(({ tag, isBase }) => ({ tag, isBase }))).toEqual([{ tag: 'hu', isBase: true }])
		expect((await listLanguages(api, project.id)).map(({ tag }) => tag)).toEqual(['sk', 'en'])
	})
})

test.describe('ADMIN reorders languages', () => {
	let api: APIRequestContext

	test.beforeAll(async ({ playwright }) => {
		api = await newAdminApi(playwright.request)
	})

	test.afterAll(async () => {
		await api?.dispose()
	})

	test('ArrowUp on the grip moves a language, announces its position and the order survives a reload', async ({ page }) => {
		const project = await createProject(api, 'languages-order', ['sk', 'en', 'hu'])
		await openLanguagesPage(page, project.slug)
		await expectRowOrder(page, ['sk', 'en', 'hu'])

		const saved = waitForLanguagesResponse(page, project.id, 'PUT')
		await getGrip(page, 'Maďarčina').press('ArrowUp')
		expect((await saved).status()).toBe(200)

		await expect(page.getByRole('status').filter({ hasText: 'Jazyk Maďarčina je na 2. mieste z 3.' })).toBeAttached()
		await expectRowOrder(page, ['sk', 'hu', 'en'])
		await expect(getGrip(page, 'Maďarčina')).toBeFocused()
		await expect(page.getByRole('dialog', { name: 'Zmeniť základný jazyk' })).toHaveCount(0)

		await page.reload()
		await expect(getTable(page)).toHaveAttribute('aria-busy', 'false')
		await expectRowOrder(page, ['sk', 'hu', 'en'])
		await expect(getBaseBadge(page, 'sk')).toBeVisible()
		expect((await listLanguages(api, project.id)).map(({ tag }) => tag)).toEqual(['sk', 'hu', 'en'])
	})

	test('moving a language to the top asks first: "Nie, vrátiť" keeps the order, "Áno, zmeniť" makes it the base', async ({ page }) => {
		const project = await createProject(api, 'languages-order-base', ['sk', 'en'])
		await openLanguagesPage(page, project.slug)
		const puts: string[] = []
		page.on('request', (request) => {
			if (request.method() === 'PUT' && request.url().includes(projectLanguagesApi(project.id))) {
				puts.push(request.url())
			}
		})
		const dialog = page.getByRole('dialog', { name: 'Zmeniť základný jazyk' })
		const message = 'Presunutím sa základným jazykom projektu stane angličtina namiesto slovenčina.'

		await getGrip(page, 'Angličtina').press('ArrowUp')
		await expect(dialog).toContainText(message)
		await dialog.getByRole('button', { name: 'Nie, vrátiť' }).click()
		await expect(dialog).toBeHidden()
		await expectRowOrder(page, ['sk', 'en'])
		await expect(getBaseBadge(page, 'sk')).toBeVisible()
		expect(puts).toEqual([])
		expect((await listLanguages(api, project.id)).map(({ tag, isBase }) => ({ tag, isBase }))).toEqual([
			{ tag: 'sk', isBase: true },
			{ tag: 'en', isBase: false },
		])

		await getGrip(page, 'Angličtina').press('ArrowUp')
		await expect(dialog).toContainText(message)
		const saved = waitForLanguagesResponse(page, project.id, 'PUT')
		await dialog.getByRole('button', { name: 'Áno, zmeniť' }).click()
		expect((await saved).status()).toBe(200)

		await expect(dialog).toBeHidden()
		await expect(page.getByText('Základný jazyk je teraz Angličtina.')).toBeVisible()
		await expectRowOrder(page, ['en', 'sk'])
		await expect(getBaseBadge(page, 'en')).toBeVisible()
		await expect(getTable(page).getByText('Základný', { exact: true })).toHaveCount(1)
		await expect(getRemoveButton(page, 'Angličtina')).toBeDisabled()
		expect((await listLanguages(api, project.id)).map(({ tag, isBase }) => ({ tag, isBase }))).toEqual([
			{ tag: 'en', isBase: true },
			{ tag: 'sk', isBase: false },
		])
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

		await page.goto(languagesPath(project.slug))
		await expect(page).toHaveURL('/login')
	})
})
