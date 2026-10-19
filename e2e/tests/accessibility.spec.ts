import AxeBuilder from '@axe-core/playwright'
import { type APIRequest, expect, type Page, test, type TestInfo } from '@playwright/test'

import { MUTATION_HEADERS } from '../support/api'
import { ANONYMOUS } from '../support/auth'
import { getImportDialog, SAMPLE_CSV } from '../support/imports'
import { listLanguages, newAdminApi } from '../support/languages'
import { createProject } from '../support/projects'
import {
	getEditTranslationDialog,
	getTranslationField,
	insertTranslationKeys,
	listTranslations,
	saveTranslation,
	setTranslationsView,
	translationKeyApi,
	type TranslationsView,
} from '../support/translations'
import { loginAsFreshAdmin } from '../support/users'

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const COLOR_SCHEMES = ['light', 'dark'] as const
const COLOR_CONTRAST = 'color-contrast'

/**
 * `path` is a function for pages of a project: it creates a test project as the ADMIN and returns its URL.
 * `prepare` runs after `ready` for screens that need interaction before the scan (an opened modal).
 * `view` signs the page in as a fresh ADMIN with that translations view: the view is saved on the user and the shared ADMIN stays EXTENDED.
 */
type Screen = {
	name: string
	path: string | ((request: APIRequest) => Promise<string>)
	ready: (page: Page) => Promise<void>
	prepare?: (page: Page) => Promise<void>
	anonymous?: boolean
	view?: TranslationsView
}

const inNewProject = (page: 'settings' | 'languages' | 'members' | 'translations') => async (request: APIRequest) => {
	const api = await newAdminApi(request)
	try {
		return `/projects/${(await createProject(api, 'a11y')).slug}/${page}`
	} finally {
		await api.dispose()
	}
}

/** Keys cover every row variant: untranslated, translated, a `{{var}}` chip and a sentence key. */
const translationsWithKeys = async (request: APIRequest) => {
	const api = await newAdminApi(request)
	try {
		const project = await createProject(api, 'a11y')
		await insertTranslationKeys(project.id, await listLanguages(api, project.id), [
			{ namespace: 'loc', name: 'orders.empty.title', values: { sk: 'Zatiaľ nemáte žiadne objednávky' } },
			{ namespace: 'loc', name: 'dashboard.welcome', values: { sk: 'Vitajte späť, {{name}}', en: 'Welcome back, {{name}}' } },
			{ namespace: 'paths', name: 'Adresa nie je kompletná. Uistite sa', values: { sk: 'Adresa nie je kompletná.', en: null } },
		])
		return `/projects/${project.slug}/translations`
	} finally {
		await api.dispose()
	}
}

/** `cart.items` made plural through the API: sk shows One/Few/Many/Other, en One/Other, the old text in Other. */
const translationsWithPluralKey = async (request: APIRequest) => {
	const api = await newAdminApi(request)
	try {
		const project = await createProject(api, 'a11y-plural')
		await insertTranslationKeys(project.id, await listLanguages(api, project.id), [
			{ namespace: 'loc', name: 'cart.items', values: { sk: 'Máte {{count}} položiek', en: 'You have {{count}} items' } },
		])
		const { keyId } = (await listTranslations(api, project.id)).items[0]!
		const response = await api.patch(translationKeyApi(project.id, keyId), { data: { plural: { variable: 'count' } }, headers: MUTATION_HEADERS })
		expect(response.status(), `PATCH ${translationKeyApi(project.id, keyId)}`).toBe(200)
		return `/projects/${project.slug}/translations`
	} finally {
		await api.dispose()
	}
}

const translationsReady = (page: Page) => expect(page.getByRole('table', { name: 'Zoznam prekladov' })).toHaveAttribute('aria-busy', 'false')

/** Step 1 with the sample file selected (name, size and the checkbox visible). */
const openImportUpload = async (page: Page) => {
	await page.getByRole('main').getByRole('button', { name: 'Importovať' }).first().click()
	await getImportDialog(page).getByLabel('Súbor s prekladmi').setInputFiles(SAMPLE_CSV)
	await expect(getImportDialog(page).getByText('import-sample.csv')).toBeVisible()
}

/** Step 2 against a project with sk and en: a matched row, an undecided `cs` row with the hint buttons, warning buttons and the summary. */
const openImportReview = async (page: Page) => {
	await openImportUpload(page)
	await getImportDialog(page).getByRole('button', { name: 'Pokračovať na kontrolu' }).click()
	await expect(getImportDialog(page).getByRole('table', { name: 'Stĺpce jazykov v súbore' })).toBeVisible()
	await getImportDialog(page).getByRole('button', { name: '1 upozornenie pre stĺpec cs' }).click()
	await expect(getImportDialog(page).getByText('Upozornenia pre stĺpec cs')).toBeVisible()
}

/** Edit translation modal of the untranslated `orders.empty.title` (en): key, language, the base language reference, the empty field and the buttons. */
const openTranslationModal = async (page: Page) => {
	await page.getByRole('button', { name: 'Preklad kľúča orders.empty.title, English:' }).click()
	await expect(getEditTranslationDialog(page).getByText('Základný jazyk (slovenčina)', { exact: true })).toBeVisible()
	await expect(getTranslationField(page, 'orders.empty.title')).toBeFocused()
}

/** Edit translation modal of `dashboard.welcome` with a rejected draft (missing `{{name}}`) and the mismatch alert under the field. */
const openTranslationMismatch = async (page: Page) => {
	await page.getByRole('button', { name: 'Preklad kľúča dashboard.welcome, English:' }).click()
	const field = getTranslationField(page, 'dashboard.welcome')
	await field.fill('Welcome back, friend')
	expect((await saveTranslation(page)).status()).toBe(400)
	await expect(getEditTranslationDialog(page).getByRole('alert')).toHaveText('Premenné v preklade sa nezhodujú so základným jazykom. Chýbajú: {{name}}.')
	await expect(field).toHaveAttribute('aria-invalid', 'true')
}

/** Edit key modal of `dashboard.welcome` with the plural checkbox on, so the variable field is scanned too. */
const openEditKeyModal = async (page: Page) => {
	await page.getByRole('button', { name: 'Upraviť kľúč dashboard.welcome', exact: true }).click()
	const dialog = page.getByRole('dialog', { name: 'Upraviť kľúč' })
	await expect(dialog.getByRole('textbox', { name: 'Kľúč', exact: true })).toHaveValue('dashboard.welcome')
	await dialog.getByRole('checkbox', { name: 'Použiť plurálové formy' }).check()
	await expect(dialog.getByLabel('Názov premennej', { exact: true })).toHaveValue('count')
}

/** Edit translation modal of the plural row (en): a field per form (One empty, Other with text), the stacked sk forms in the reference block. */
const openPluralModal = async (page: Page) => {
	await page.getByRole('button', { name: 'Preklad kľúča cart.items, English:' }).click()
	await expect(getTranslationField(page, 'cart.items', 'English', 'Jeden')).toBeFocused()
	await expect(getTranslationField(page, 'cart.items', 'English', 'Iné')).toHaveText('You have {{count}} items')
}

const translationsRowsReady = (count: number) => (page: Page) =>
	expect(page.getByRole('table', { name: 'Zoznam prekladov' }).locator('tr[data-status]')).toHaveCount(count)

const SCREENS: Screen[] = [
	{
		name: 'login',
		path: '/login',
		anonymous: true,
		ready: (page) => expect(page.getByRole('heading', { level: 1, name: 'Vitajte späť' })).toBeVisible(),
	},
	{
		name: 'projects',
		path: '/',
		ready: (page) => expect(page.getByRole('list', { name: 'Zoznam projektov' })).toBeVisible(),
	},
	{
		name: 'users',
		path: '/admin/users',
		ready: (page) => expect(page.getByRole('table', { name: 'Zoznam používateľov' })).toHaveAttribute('aria-busy', 'false'),
	},
	{
		name: 'project translations extended',
		path: translationsWithKeys,
		ready: translationsRowsReady(3),
	},
	{
		name: 'project translations compact',
		path: translationsWithKeys,
		ready: translationsRowsReady(3),
		view: 'COMPACT',
	},
	{
		name: 'edit translation modal',
		path: translationsWithKeys,
		ready: translationsRowsReady(3),
		prepare: openTranslationModal,
	},
	{
		name: 'edit translation modal in compact view',
		path: translationsWithKeys,
		ready: translationsRowsReady(3),
		prepare: openTranslationModal,
		view: 'COMPACT',
	},
	{
		name: 'edit translation modal mismatch',
		path: translationsWithKeys,
		ready: translationsRowsReady(3),
		prepare: openTranslationMismatch,
	},
	{
		name: 'edit key modal',
		path: translationsWithKeys,
		ready: translationsReady,
		prepare: openEditKeyModal,
	},
	{
		name: 'edit translation modal of a plural key',
		path: translationsWithPluralKey,
		ready: translationsRowsReady(1),
		prepare: openPluralModal,
	},
	{
		name: 'import modal step 1',
		path: inNewProject('translations'),
		ready: translationsReady,
		prepare: openImportUpload,
	},
	{
		name: 'import modal step 2',
		path: inNewProject('translations'),
		ready: translationsReady,
		prepare: openImportReview,
	},
	{
		name: 'admin projects',
		path: '/admin/projects',
		ready: (page) => expect(page.getByRole('table', { name: 'Zoznam projektov' })).toHaveAttribute('aria-busy', 'false'),
	},
	{
		name: 'project languages',
		path: inNewProject('languages'),
		ready: (page) => expect(page.getByRole('table', { name: 'Zoznam jazykov' })).toHaveAttribute('aria-busy', 'false'),
	},
	{
		name: 'profile',
		path: '/profile',
		ready: (page) => expect(page.getByRole('heading', { level: 1, name: 'Môj profil' })).toBeVisible(),
	},
	{
		name: 'project settings',
		path: inNewProject('settings'),
		ready: (page) => expect(page.getByRole('button', { name: 'Uložiť zmeny' })).toBeVisible(),
	},
	{
		name: 'members',
		path: inNewProject('members'),
		ready: (page) => expect(page.getByRole('table', { name: 'Zoznam členov' })).toHaveAttribute('aria-busy', 'false'),
	},
]

const openScreen = async (page: Page, request: APIRequest, baseURL: string | undefined, screen: Screen, colorScheme: (typeof COLOR_SCHEMES)[number]) => {
	if (screen.view) {
		await loginAsFreshAdmin(page, request, baseURL)
		await setTranslationsView(page.request, screen.view)
	}
	// Set per page, never through the shared storageState, so other tests keep the light default.
	await page.addInitScript((value) => localStorage.setItem('mantine-color-scheme-value', value), colorScheme)
	await page.goto(typeof screen.path === 'string' ? screen.path : await screen.path(request))
	await screen.ready(page)
	await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', colorScheme)
	await screen.prepare?.(page)
}

const expectNoViolations = async (axe: AxeBuilder, testInfo: TestInfo) => {
	const { violations } = await axe.analyze()
	await testInfo.attach('axe-violations', { body: JSON.stringify(violations, null, 2), contentType: 'application/json' })
	expect(violations.map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map(({ target }) => target.join(' ')) }))).toEqual([])
}

for (const screen of SCREENS) {
	test.describe(`${screen.name} page`, () => {
		if (screen.anonymous || screen.view) {
			test.use({ storageState: ANONYMOUS })
		}

		for (const colorScheme of COLOR_SCHEMES) {
			test(`has no WCAG 2.2 AA violations in ${colorScheme} scheme`, async ({ page, playwright, baseURL }, testInfo) => {
				await openScreen(page, playwright.request, baseURL, screen, colorScheme)
				await expectNoViolations(new AxeBuilder({ page }).withTags(WCAG_TAGS).disableRules([COLOR_CONTRAST]), testInfo)
			})

			// TODO: enable once the brand button, dimmed text and eyebrow tokens meet AA contrast (design decision, see docs/testing.md).
			test.fixme(`has AA text contrast in ${colorScheme} scheme`, async ({ page, playwright, baseURL }, testInfo) => {
				await openScreen(page, playwright.request, baseURL, screen, colorScheme)
				await expectNoViolations(new AxeBuilder({ page }).withRules([COLOR_CONTRAST]), testInfo)
			})
		}
	})
}
