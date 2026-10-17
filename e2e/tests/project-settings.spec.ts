import { type APIRequestContext, expect, type Page, test } from '@playwright/test'

import { MUTATION_HEADERS, readApiError } from '../support/api'
import { ANONYMOUS, STORAGE_STATE } from '../support/auth'
import { acquireLanguagesLock, type Language, listLanguages, newAdminApi } from '../support/languages'
import { getMainNavigation } from '../support/layout'
import { getProjectSettings, PROJECT_API, type ProjectSettings, restoreProjectSettings } from '../support/project-settings'

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

const openProjectSettingsPage = async (page: Page) => {
	await page.goto('/project-settings')
	await expect(page.getByRole('heading', PAGE_HEADING)).toBeVisible()
	await expect(getForm(page).save).toBeVisible()
}

const expectFormValues = async (page: Page, settings: Omit<ProjectSettings, 'id' | 'baseLanguageId'>, baseLanguage: Language) => {
	const form = getForm(page)
	await expect(form.name).toHaveValue(settings.name)
	await expect(form.slug).toHaveValue(settings.slug)
	await expect(form.color).toHaveValue(settings.primaryColor)
	await expect(form.preview).toHaveCSS('background-color', hexToRgb(settings.primaryColor))
	await expect(form.baseLanguage).toHaveValue(languageLabel(baseLanguage))
	if (settings.protectVariables) {
		await expect(form.protectVariables).toBeChecked()
	} else {
		await expect(form.protectVariables).not.toBeChecked()
	}
}

const waitForProjectResponse = (page: Page, method: string) =>
	page.waitForResponse((response) => response.url().endsWith(PROJECT_API) && response.request().method() === method)

const getLanguagesTable = (page: Page) => page.getByRole('table', { name: 'Zoznam jazykov' })

const getBaseBadge = (page: Page, tag: string) =>
	getLanguagesTable(page)
		.getByRole('row')
		.filter({ has: page.getByText(new RegExp(`· ${escapeRegExp(tag)}$`)) })
		.getByText('Základný', { exact: true })

test.describe('ADMIN', () => {
	// The project and the base language are shared with languages.spec and the other browser project: the lock serializes them.
	test.describe.configure({ mode: 'serial' })

	let api: APIRequestContext
	let releaseLock: (() => Promise<void>) | undefined
	let original: ProjectSettings | undefined
	let languages: Language[]
	let originalBase: Language

	test.beforeAll(async ({ playwright }) => {
		// Waiting for the other browser project to release the lock counts against this hook.
		test.setTimeout(180_000)
		releaseLock = await acquireLanguagesLock()
		api = await newAdminApi(playwright.request)
		original = await getProjectSettings(api)
		languages = await listLanguages(api)
		const base = languages.find(({ isBase }) => isBase)
		expect(base, 'a base language in the DB').toBeDefined()
		expect(original.baseLanguageId).toBe(base!.id)
		originalBase = base!
	})

	test.afterAll(async () => {
		try {
			if (api) {
				if (original) {
					await restoreProjectSettings(api, original)
					expect(await getProjectSettings(api)).toEqual(original)
				}
				await api.dispose()
			}
		} finally {
			await releaseLock?.()
		}
	})

	test('opens Nastavenia projektu from the sidebar and sees the saved values prefilled', async ({ page }) => {
		await page.goto('/')
		const item = getMainNavigation(page).getByRole('list', { name: 'Správa' }).getByRole('link', { name: 'Nastavenia projektu' })
		await expect(item).toHaveAttribute('href', '/project-settings')
		await item.click()
		await expect(page).toHaveURL('/project-settings')
		await expect(page.getByRole('heading', PAGE_HEADING)).toBeVisible()
		await expect(item).toHaveAttribute('aria-current', 'page')

		await expectFormValues(page, original!, originalBase)
		await expect(getForm(page).save).toBeDisabled()
	})

	test('Opustiť projekt is disabled and explains why in a tooltip', async ({ page }) => {
		await openProjectSettingsPage(page)
		const { leave } = getForm(page)
		await expect(leave).toBeVisible()
		await expect(leave).toBeDisabled()
		await leave.hover()
		await expect(page.getByRole('tooltip')).toHaveText('Bude dostupné spolu so správou členov')
	})

	test('saves name, slug, color and the switch; the values stay after a reload', async ({ page }, testInfo) => {
		const edited = {
			name: `E2E Projekt ${testInfo.project.name}`,
			slug: `e2e-projekt-${testInfo.project.name}`,
			primaryColor: '#1A2B3C',
			protectVariables: !original!.protectVariables,
		}
		await openProjectSettingsPage(page)
		const form = getForm(page)

		await form.name.fill(`  ${edited.name} `)
		await form.slug.fill(edited.slug)
		await form.protectVariables.click()
		await form.color.fill(edited.primaryColor.toLowerCase())
		await form.color.press('Escape')
		await expect(form.preview).toHaveCSS('background-color', hexToRgb(edited.primaryColor))
		await expect(form.save).toBeEnabled()

		const patched = waitForProjectResponse(page, 'PATCH')
		await form.save.click()
		const response = await patched
		expect(response.status()).toBe(200)
		expect(await response.json()).toMatchObject({ ...edited, baseLanguageId: originalBase.id })
		await expect(page.getByText(SAVE_SUCCESS)).toBeVisible()
		await expectFormValues(page, edited, originalBase)
		await expect(form.save).toBeDisabled()

		await page.reload()
		await expect(form.save).toBeVisible()
		await expectFormValues(page, edited, originalBase)
		expect(await getProjectSettings(api)).toEqual({ ...original, ...edited })

		await restoreProjectSettings(api, original!)
	})

	test('changing the base language moves the Základný badge on /languages', async ({ page }) => {
		const others = languages.filter(({ id }) => id !== originalBase.id)
		const target = others.find(({ tag }) => tag === 'en') ?? others.find(({ tag }) => tag === 'sk') ?? others[0]
		expect(target, 'another language to become the base').toBeDefined()

		await openProjectSettingsPage(page)
		const form = getForm(page)
		await form.baseLanguage.click()
		await page.getByRole('option', { name: new RegExp(`${escapeRegExp(languageLabel(target!))}$`) }).click()
		await expect(form.baseLanguage).toHaveValue(languageLabel(target!))

		const patched = waitForProjectResponse(page, 'PATCH')
		await form.save.click()
		expect((await patched).status()).toBe(200)
		await expect(page.getByText(SAVE_SUCCESS)).toBeVisible()

		await page.goto('/languages')
		await expect(getLanguagesTable(page)).toHaveAttribute('aria-busy', 'false')
		await expect(getBaseBadge(page, target!.tag)).toBeVisible()
		await expect(getBaseBadge(page, originalBase.tag)).toHaveCount(0)
		await expect(getLanguagesTable(page).getByText('Základný', { exact: true })).toHaveCount(1)
		expect((await listLanguages(api)).filter(({ isBase }) => isBase).map(({ id }) => id)).toEqual([target!.id])

		await restoreProjectSettings(api, original!)
		await page.reload()
		await expect(getLanguagesTable(page)).toHaveAttribute('aria-busy', 'false')
		await expect(getBaseBadge(page, originalBase.tag)).toBeVisible()
		await expect(getLanguagesTable(page).getByText('Základný', { exact: true })).toHaveCount(1)
	})

	test('invalid name, slug and color show field errors and nothing is sent', async ({ page }) => {
		await openProjectSettingsPage(page)
		const form = getForm(page)
		const patches: string[] = []
		page.on('request', (request) => {
			if (request.method() === 'PATCH' && request.url().endsWith(PROJECT_API)) {
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
		await expect(form.preview).toHaveCSS('background-color', hexToRgb(original!.primaryColor))
		await expect(page.getByText(SAVE_SUCCESS)).toHaveCount(0)
		expect(patches).toEqual([])

		await page.reload()
		await expect(form.save).toBeVisible()
		await expectFormValues(page, original!, originalBase)
		expect(await getProjectSettings(api)).toEqual(original)
	})
})

test.describe('EDITOR', () => {
	test.use({ storageState: STORAGE_STATE.EDITOR })

	test('does not see Nastavenia projektu in the sidebar', async ({ page }) => {
		await page.goto('/')
		await expect(getMainNavigation(page)).toBeAttached()
		await expect(page.getByRole('link', { name: 'Nastavenia projektu' })).toHaveCount(0)
	})

	test('/project-settings shows the 403 page and the API returns 403', async ({ page }) => {
		await page.goto('/project-settings')
		await expect(page.getByRole('heading', { level: 1, name: 'Prístup zamietnutý' })).toBeVisible()
		await expect(page).toHaveURL('/project-settings')
		await expect(page.getByRole('heading', PAGE_HEADING)).toHaveCount(0)
		await expect(page.getByRole('button', { name: 'Uložiť zmeny' })).toHaveCount(0)

		const read = await page.request.get(PROJECT_API)
		expect(read.status()).toBe(403)
		expect((await readApiError(read)).code).toBe('FORBIDDEN')

		// An empty body: even if the role check were missing, validation would reject it before anything is saved.
		const update = await page.request.patch(PROJECT_API, { data: {}, headers: MUTATION_HEADERS })
		expect(update.status()).toBe(403)
		expect((await readApiError(update)).code).toBe('FORBIDDEN')
	})
})

test.describe('anonymous', () => {
	test.use({ storageState: ANONYMOUS })

	test('/project-settings redirects to /login and the API returns 401', async ({ page }) => {
		await page.goto('/project-settings')
		await expect(page).toHaveURL('/login')
		await expect(page.getByRole('heading', { level: 1, name: 'Vitajte späť' })).toBeVisible()

		const response = await page.request.get(PROJECT_API)
		expect(response.status()).toBe(401)
		expect((await readApiError(response)).code).toBe('AUTH_UNAUTHENTICATED')
	})
})
