import { type APIRequestContext, expect, type Page, test } from '@playwright/test'

import { readApiError } from '../support/api'
import { ANONYMOUS, loginViaUi } from '../support/auth'
import { type Language, listLanguages, newAdminApi } from '../support/languages'
import { getMainNavigation } from '../support/layout'
import { createProject, getProjectSettings, projectSettingsApi, type ProjectSettings } from '../support/projects'
import { createEditor, type TestEditor } from '../support/users'

const PAGE_HEADING = { level: 1, name: 'Nastavenia projektu' } as const
const SAVE_SUCCESS = 'Nastavenia projektu boli uložené.'
const INVALID = 'Neplatná hodnota.'

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const hexToRgb = (hex: string) => {
	const [r, g, b] = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16))
	return `rgb(${r}, ${g}, ${b})`
}

const languageLabel = ({ englishName, tag }: Language) => `${englishName} (${tag})`

const getForm = (page: Page) => ({
	name: page.getByLabel('Názov projektu', { exact: true }),
	slug: page.getByLabel('Slug projektu', { exact: true }),
	color: page.getByLabel('Primárna farba', { exact: true }),
	baseLanguage: page.getByLabel('Základný jazyk', { exact: true }),
	protectVariables: page.getByRole('switch', { name: /^Chrániť výrazy \{\{ variable \}\}/ }),
	preview: page.getByText('Ukážka', { exact: true }),
	save: page.getByRole('button', { name: 'Uložiť zmeny' }),
	leave: page.getByRole('button', { name: 'Opustiť projekt' }),
})

const settingsPath = (projectId: string) => `/projects/${projectId}/settings`

const openProjectSettingsPage = async (page: Page, projectId: string) => {
	await page.goto(settingsPath(projectId))
	await expect(page.getByRole('heading', PAGE_HEADING)).toBeVisible()
	await expect(getForm(page).save).toBeVisible()
}

/** Settings without the base language, for comparisons that only care about the edited fields. */
const omitBase = ({ baseLanguageId: _, ...settings }: ProjectSettings) => settings

/** The base language is checked only when given. */
const expectFormValues = async (page: Page, settings: Omit<ProjectSettings, 'id' | 'baseLanguageId'>, baseLanguage?: Language) => {
	const form = getForm(page)
	await expect(form.name).toHaveValue(settings.name)
	await expect(form.slug).toHaveValue(settings.slug)
	await expect(form.color).toHaveValue(settings.primaryColor)
	await expect(form.preview).toHaveCSS('background-color', hexToRgb(settings.primaryColor))
	if (baseLanguage) {
		await expect(form.baseLanguage).toHaveValue(languageLabel(baseLanguage))
	}
	if (settings.protectVariables) {
		await expect(form.protectVariables).toBeChecked()
	} else {
		await expect(form.protectVariables).not.toBeChecked()
	}
}

const waitForProjectResponse = (page: Page, projectId: string, method: string) =>
	page.waitForResponse((response) => response.url().endsWith(projectSettingsApi(projectId)) && response.request().method() === method)

const getLanguagesTable = (page: Page) => page.getByRole('table', { name: 'Zoznam jazykov' })

const getBaseBadge = (page: Page, tag: string) =>
	getLanguagesTable(page)
		.getByRole('row')
		.filter({ has: page.getByText(new RegExp(`· ${escapeRegExp(tag)}$`)) })
		.getByText('Základný', { exact: true })

test.describe('ADMIN', () => {
	// Each browser project works on its own test project; only the base language is shared, see the next describe.
	test.describe.configure({ mode: 'serial' })

	let api: APIRequestContext
	let original: ProjectSettings

	const withoutBase = async (projectId: string) => omitBase(await getProjectSettings(api, projectId))

	test.beforeAll(async ({ playwright }) => {
		api = await newAdminApi(playwright.request)
		original = await getProjectSettings(api, (await createProject(api, 'settings')).id)
	})

	test.afterAll(async () => {
		await api?.dispose()
	})

	test('opens the project from the project list and sees the saved values prefilled', async ({ page }) => {
		await page.goto('/')
		await page.getByRole('list', { name: 'Zoznam projektov' }).getByRole('link', { name: original.name }).click()
		await expect(page).toHaveURL(settingsPath(original.id))
		await expect(page.getByRole('heading', PAGE_HEADING)).toBeVisible()
		const item = getMainNavigation(page).getByRole('list', { name: original.name }).getByRole('link', { name: 'Nastavenia projektu' })
		await expect(item).toHaveAttribute('aria-current', 'page')

		await expectFormValues(page, original)
		await expect(getForm(page).save).toBeDisabled()
		await expect(getForm(page).leave).toBeEnabled()
	})

	test('saves name, slug, color and the switch; the values stay after a reload', async ({ page }) => {
		const edited = {
			name: `${original.name} upravený`,
			slug: `${original.slug}-x`,
			primaryColor: '#1A2B3C',
			protectVariables: !original.protectVariables,
		}
		await openProjectSettingsPage(page, original.id)
		const form = getForm(page)

		await form.name.fill(`  ${edited.name} `)
		await form.slug.fill(edited.slug)
		await form.protectVariables.click()
		await form.color.fill(edited.primaryColor.toLowerCase())
		await form.color.press('Escape')
		await expect(form.preview).toHaveCSS('background-color', hexToRgb(edited.primaryColor))
		await expect(form.save).toBeEnabled()

		const patched = waitForProjectResponse(page, original.id, 'PATCH')
		await form.save.click()
		const response = await patched
		expect(response.status()).toBe(200)
		expect(await response.json()).toMatchObject(edited)
		await expect(page.getByText(SAVE_SUCCESS)).toBeVisible()
		await expectFormValues(page, edited)
		await expect(form.save).toBeDisabled()
		await expect(getMainNavigation(page).getByRole('list', { name: edited.name })).toBeVisible()

		await page.reload()
		await expect(form.save).toBeVisible()
		await expectFormValues(page, edited)
		expect(await withoutBase(original.id)).toEqual({ ...omitBase(original), ...edited })
		original = { ...original, ...edited }
	})

	test('invalid name, slug and color show field errors and nothing is sent', async ({ page }) => {
		await openProjectSettingsPage(page, original.id)
		const form = getForm(page)
		const patches: string[] = []
		page.on('request', (request) => {
			if (request.method() === 'PATCH' && request.url().endsWith(projectSettingsApi(original.id))) {
				patches.push(request.url())
			}
		})

		await form.name.fill('   ')
		await form.slug.fill('Neplatny slug')
		await form.color.fill('red')
		await form.color.press('Escape')
		await form.save.click()

		await expect(form.name).toHaveAttribute('aria-invalid', 'true')
		await expect(form.name).toHaveAccessibleDescription('Toto pole je povinné.')
		await expect(form.slug).toHaveAttribute('aria-invalid', 'true')
		await expect(form.slug).toHaveAccessibleDescription(new RegExp(escapeRegExp(INVALID)))
		await expect(form.color).toHaveAttribute('aria-invalid', 'true')
		await expect(form.color).toHaveAccessibleDescription(INVALID)
		// The preview keeps the last valid color.
		await expect(form.preview).toHaveCSS('background-color', hexToRgb(original.primaryColor))
		await expect(page.getByText(SAVE_SUCCESS)).toHaveCount(0)
		expect(patches).toEqual([])

		await page.reload()
		await expect(form.save).toBeVisible()
		await expectFormValues(page, original)
		expect(await withoutBase(original.id)).toEqual(omitBase(original))
	})

	test('a slug of another project shows 409 at the slug field', async ({ page }) => {
		const other = await createProject(api, 'taken')
		await openProjectSettingsPage(page, original.id)
		const form = getForm(page)

		await form.slug.fill(other.slug)
		const patched = waitForProjectResponse(page, original.id, 'PATCH')
		await form.save.click()
		expect((await patched).status()).toBe(409)

		await expect(form.slug).toHaveAttribute('aria-invalid', 'true')
		await expect(form.slug).toHaveAccessibleDescription(/Projekt s týmto slugom už existuje\./)
		expect(await withoutBase(original.id)).toEqual(omitBase(original))
	})
})

test.describe('ADMIN base language', () => {
	test('changing the base language moves the Základný badge on the Jazyky page of the project only', async ({ page, playwright }) => {
		const api = await newAdminApi(playwright.request)
		const project = await createProject(api, 'base', ['sk', 'en'])
		const other = await createProject(api, 'base-other', ['sk', 'en'])
		const english = (await listLanguages(api, project.id)).find(({ tag }) => tag === 'en')!

		await openProjectSettingsPage(page, project.id)
		const form = getForm(page)
		await expect(form.baseLanguage).toHaveValue('Slovak (sk)')
		await form.baseLanguage.click()
		await page.getByRole('option', { name: new RegExp(`${escapeRegExp(languageLabel(english))}$`) }).click()
		const patched = waitForProjectResponse(page, project.id, 'PATCH')
		await form.save.click()
		expect((await patched).status()).toBe(200)
		await expect(page.getByText(SAVE_SUCCESS)).toBeVisible()

		await page.goto(`/projects/${project.id}/languages`)
		await expect(getLanguagesTable(page)).toHaveAttribute('aria-busy', 'false')
		await expect(getBaseBadge(page, 'en')).toBeVisible()
		await expect(getBaseBadge(page, 'sk')).toHaveCount(0)
		// The base language is per project now: the other project keeps sk.
		expect((await listLanguages(api, other.id)).filter(({ isBase }) => isBase).map(({ tag }) => tag)).toEqual(['sk'])
		await api.dispose()
	})
})

test.describe('EDITOR', () => {
	test.use({ storageState: ANONYMOUS })

	let editor: TestEditor

	test.beforeEach(async ({ page, playwright, baseURL }) => {
		editor = await createEditor(playwright.request, baseURL)
		await loginViaUi(page, editor)
		await expect(page).toHaveURL('/')
	})

	test('a member saves the settings of an own project', async ({ page }) => {
		const editorApi = page.request
		await openProjectSettingsPage(page, editor.projectId)
		const form = getForm(page)
		const before = await getProjectSettings(editorApi, editor.projectId)

		await expect(form.baseLanguage).toBeEnabled()
		await form.name.fill(`${before.name} člen`)
		const patched = waitForProjectResponse(page, editor.projectId, 'PATCH')
		await form.save.click()
		expect((await patched).status()).toBe(200)
		await expect(page.getByText(SAVE_SUCCESS)).toBeVisible()
		expect(omitBase(await getProjectSettings(editorApi, editor.projectId))).toEqual({ ...omitBase(before), name: `${before.name} člen` })
	})

	test('a project the member is not in shows Projekt sa nenašiel and the API returns 404', async ({ page, playwright }) => {
		const adminApi = await newAdminApi(playwright.request)
		const foreign = await createProject(adminApi, 'foreign')
		await adminApi.dispose()

		await page.goto(settingsPath(foreign.id))
		await expect(page.getByRole('heading', { level: 1, name: 'Projekt sa nenašiel' })).toBeVisible()
		await expect(page.getByRole('link', { name: 'Späť na projekty' })).toHaveAttribute('href', '/')
		await expect(page.getByRole('heading', PAGE_HEADING)).toHaveCount(0)

		const read = await page.request.get(projectSettingsApi(foreign.id))
		expect(read.status()).toBe(404)
		expect((await readApiError(read)).code).toBe('NOT_FOUND')
	})
})

test.describe('anonymous', () => {
	test.use({ storageState: ANONYMOUS })

	test('a project URL redirects to /login and the API returns 401', async ({ page, playwright }) => {
		const adminApi = await newAdminApi(playwright.request)
		const project = await createProject(adminApi, 'anonymous')
		await adminApi.dispose()

		await page.goto(settingsPath(project.id))
		await expect(page).toHaveURL('/login')
		await expect(page.getByRole('heading', { level: 1, name: 'Vitajte späť' })).toBeVisible()

		const response = await page.request.get(projectSettingsApi(project.id))
		expect(response.status()).toBe(401)
		expect((await readApiError(response)).code).toBe('AUTH_UNAUTHENTICATED')
	})
})
