import AxeBuilder from '@axe-core/playwright'
import { type APIRequest, expect, type Page, test, type TestInfo } from '@playwright/test'

import { MUTATION_HEADERS } from '../support/api'
import { ANONYMOUS } from '../support/auth'
import { getExportDialog } from '../support/exports'
import { getImportDialog, importFile, importSample, NEXT_CSV, SAMPLE_CSV } from '../support/imports'
import { listLanguages, newAdminApi } from '../support/languages'
import { createProject } from '../support/projects'
import {
	createProjectWithKeys,
	getDiffSwitch,
	getEditTranslationDialog,
	getTranslationField,
	insertTranslationKeys,
	listTranslations,
	saveTranslation,
	setTranslationsView,
	translationApi,
	translationKeyApi,
	type TranslationsView,
} from '../support/translations'
import { loginAsFreshAdmin } from '../support/users'
import { createProjectWithVersion, createVersion, getDeleteVersionDialog, getVersionRow, PAST_WINDOW } from '../support/versions'

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

const inNewProject = (page: 'settings' | 'languages' | 'members') => async (request: APIRequest) => {
	const api = await newAdminApi(request)
	try {
		return `/projects/${(await createProject(api, 'a11y')).slug}/${page}`
	} finally {
		await api.dispose()
	}
}

/** Preklady of a project with a running version `v2.45` holding `import-next.csv` (sk, en), so the modals have a table of 10 keys behind them. */
const translationsWithNext = async (request: APIRequest) => {
	const api = await newAdminApi(request)
	try {
		const project = await createProjectWithVersion(api, 'a11y')
		const [sk, en] = await listLanguages(api, project.id)
		await importFile(api, project.id, project.version.id, NEXT_CSV, [
			{ columnIndex: 2, languageId: sk!.id },
			{ columnIndex: 3, languageId: en!.id },
		])
		return `/projects/${project.slug}/translations`
	} finally {
		await api.dispose()
	}
}

/** Preklady of a project with a running version without an import: the empty state of the version with its Importovať. */
const translationsWithEmptyVersion = async (request: APIRequest) => {
	const api = await newAdminApi(request)
	try {
		return `/projects/${(await createProjectWithVersion(api, 'a11y')).slug}/translations`
	} finally {
		await api.dispose()
	}
}

/** Preklady of a project without a version: the empty state asking to create one. */
const translationsWithoutVersions = async (request: APIRequest) => {
	const api = await newAdminApi(request)
	try {
		return `/projects/${(await createProject(api, 'a11y')).slug}/translations`
	} finally {
		await api.dispose()
	}
}

/** A running and a locked version with an import (key count and the import meta) and an empty upcoming one, so the table shows every state and every action. */
const versionsWithRows = async (request: APIRequest) => {
	const api = await newAdminApi(request)
	try {
		const project = await createProjectWithVersion(api, 'a11y')
		const past = await createVersion(api, project.id, { name: 'v2.44', ...PAST_WINDOW })
		await importSample(api, project.id, past.id, { sk: 'sk', en: 'en', cs: null })
		await importSample(api, project.id, project.version.id, { sk: 'sk', en: 'en', cs: null })
		return `/projects/${project.slug}/versions`
	} finally {
		await api.dispose()
	}
}

/** Preklady of `v2.45` imported from `import-next.csv` over `v2.44` from the sample, with Zobraziť len zmeny on: the Nové badge and changed cells. */
const translationsWithDiff = async (request: APIRequest) => {
	const api = await newAdminApi(request)
	try {
		const project = await createProjectWithVersion(api, 'a11y-diff')
		const [sk, en] = await listLanguages(api, project.id)
		const past = await createVersion(api, project.id, { name: 'v2.44', ...PAST_WINDOW })
		await importSample(api, project.id, past.id, { sk: 'sk', en: 'en', cs: null })
		await importFile(api, project.id, project.version.id, NEXT_CSV, [
			{ columnIndex: 2, languageId: sk!.id },
			{ columnIndex: 3, languageId: en!.id },
		])
		return `/projects/${project.slug}/translations?diff=true`
	} finally {
		await api.dispose()
	}
}

/** Keys cover every row variant: untranslated, translated, a `{{var}}` chip and a sentence key. */
const translationsWithKeys = async (request: APIRequest) => {
	const api = await newAdminApi(request)
	try {
		const project = await createProjectWithKeys(
			api,
			'a11y',
			[
				{ namespace: 'loc', name: 'orders.empty.title', values: { sk: 'Zatiaľ nemáte žiadne objednávky' } },
				{ namespace: 'loc', name: 'dashboard.welcome', values: { sk: 'Vitajte späť, {{name}}', en: 'Welcome back, {{name}}' } },
				{ namespace: 'paths', name: 'Adresa nie je kompletná. Uistite sa', values: { sk: 'Adresa nie je kompletná.', en: null } },
			],
			['sk', 'en'],
		)
		return `/projects/${project.slug}/translations`
	} finally {
		await api.dispose()
	}
}

/** A `;` in the en value of `nav.home` blocks the export, so the modal shows the 422 list. */
const translationsWithUnsafeValue = async (request: APIRequest) => {
	const api = await newAdminApi(request)
	try {
		const project = await createProjectWithKeys(
			api,
			'a11y',
			[{ namespace: 'loc', name: 'nav.home', values: { sk: 'Domov', en: 'Home&nbsp;page' } }],
			['sk', 'en'],
		)
		return `/projects/${project.slug}/translations`
	} finally {
		await api.dispose()
	}
}

/** `cart.items` made plural through the API: sk shows One/Few/Many/Other, en One/Other, the old text in Other. */
const translationsWithPluralKey = async (request: APIRequest) => {
	const api = await newAdminApi(request)
	try {
		const project = await createProjectWithKeys(
			api,
			'a11y-plural',
			[{ namespace: 'loc', name: 'cart.items', values: { sk: 'Máte {{count}} položiek', en: 'You have {{count}} items' } }],
			['sk', 'en'],
		)
		const { keyId } = (await listTranslations(api, project.id, project.version.id)).items[0]!
		const response = await api.patch(translationKeyApi(project.id, keyId), { data: { plural: { variable: 'count' } }, headers: MUTATION_HEADERS })
		expect(response.status(), `PATCH ${translationKeyApi(project.id, keyId)}`).toBe(200)
		return `/projects/${project.slug}/translations`
	} finally {
		await api.dispose()
	}
}

/** Prehľad with every section filled: keys, three languages, a translation edit in the feed (with its row action) and a bar today. */
const dashboardWithData = async (request: APIRequest) => {
	const api = await newAdminApi(request)
	try {
		const project = await createProjectWithVersion(api, 'a11y-dashboard', ['sk', 'en', 'cs'])
		const languages = await listLanguages(api, project.id)
		await insertTranslationKeys(project.id, project.version.id, languages, [
			{ namespace: 'loc', name: 'nav.home', values: { sk: 'Domov', en: 'Home', cs: 'Domů' } },
			{ namespace: 'loc', name: 'nav.orders', values: { sk: 'Objednávky' } },
		])
		const { keyId } = (await listTranslations(api, project.id, project.version.id)).items.find(({ name }) => name === 'nav.orders')!
		const en = languages.find(({ tag }) => tag === 'en')!
		const response = await api.put(translationApi(project.id, keyId, en.id), { data: { value: 'Orders' }, headers: MUTATION_HEADERS })
		expect(response.status(), `PUT ${translationApi(project.id, keyId, en.id)}`).toBe(200)
		return `/projects/${project.slug}/dashboard`
	} finally {
		await api.dispose()
	}
}

const dashboardReady = async (page: Page) => {
	await expect(page.getByRole('region', { name: 'Štatistiky projektu' })).toHaveAttribute('aria-busy', 'false')
	await expect(page.getByRole('list', { name: 'Stav jazykov' }).getByRole('listitem')).toHaveCount(3)
	await expect(page.getByRole('list', { name: 'Dnes' }).getByRole('listitem').first()).toContainText('úprava prekladu nav.orders')
	await expect(page.getByRole('list', { name: 'Najaktívnejší členovia' })).toBeVisible()
}

const translationsReady = (page: Page) => expect(page.getByRole('table', { name: 'Zoznam prekladov' })).toHaveAttribute('aria-busy', 'false')

const emptyVersionReady = (page: Page) =>
	expect(page.getByRole('main').getByText('Verzia v2.45 zatiaľ nemá import. Importujte do nej preklady.').first()).toBeVisible()

const noVersionsReady = (page: Page) =>
	expect(page.getByRole('main').getByText('Projekt zatiaľ nemá žiadnu verziu. Vytvorte ju a importujte do nej preklady.')).toBeVisible()

const diffReady = async (page: Page) => {
	await translationsRowsReady(4)(page)
	await expect(getDiffSwitch(page)).toBeChecked()
	await expect(page.getByText('Oproti v2.44: 2 nové, 2 zmenené, 2 odstránené kľúče.')).toBeVisible()
}

/** The confirmation before deleting the locked `v2.44` with its key count. */
const openDeleteVersionModal = async (page: Page) => {
	await getVersionRow(page, 'v2.44').getByRole('button', { name: 'Zmazať verziu v2.44' }).click()
	await expect(getDeleteVersionDialog(page)).toContainText('Zmazanie verzie v2.44 odstráni aj jej 10 kľúčov s prekladmi.')
}

/** Step 1 with the sample file selected (name, size and the checkbox visible). */
const openImportUpload = async (page: Page) => {
	await page.getByRole('main').getByRole('button', { name: 'Importovať' }).first().click()
	await getImportDialog(page).getByLabel('Súbor s prekladmi').setInputFiles(SAMPLE_CSV)
	await expect(getImportDialog(page).getByText('import-sample.csv')).toBeVisible()
}

/**
 * Step 2 of the sample against the version holding `import-next.csv` (sk, en): matched rows, an undecided `cs` row with the hint buttons,
 * warning buttons, the summary with the version and the warning listing the two keys of the version the import would remove.
 */
const openImportReview = async (page: Page) => {
	await openImportUpload(page)
	await getImportDialog(page).getByRole('button', { name: 'Pokračovať na kontrolu' }).click()
	await expect(getImportDialog(page).getByRole('table', { name: 'Stĺpce jazykov v súbore' })).toBeVisible()
	await getImportDialog(page).getByRole('button', { name: '1 upozornenie pre stĺpec cs' }).click()
	await expect(getImportDialog(page).getByText('Upozornenia pre stĺpec cs')).toBeVisible()
	await expect(getImportDialog(page).getByText('Verzia: v2.45')).toBeVisible()
	await expect(getImportDialog(page).getByText('Import odstráni 2 kľúče verzie, ktoré v súbore nie sú:')).toBeVisible()
}

/** The export modal with its defaults: CSV checked, the other formats disabled, every language, Všetky and the file name. */
const openExport = async (page: Page) => {
	await page.getByRole('main').getByRole('button', { name: 'Exportovať' }).click()
	await expect(getExportDialog(page).getByRole('checkbox', { name: 'Slovenčina' })).toBeChecked()
}

/** Every language unchecked and an invalid file name: both field errors. */
const openExportWithFieldErrors = async (page: Page) => {
	await openExport(page)
	const dialog = getExportDialog(page)
	await dialog.getByRole('checkbox', { name: 'Slovenčina' }).click()
	await dialog.getByRole('checkbox', { name: 'Angličtina' }).click()
	await dialog.getByRole('textbox', { name: /^Názov súboru/ }).fill('preklady/sk')
	await dialog.getByRole('button', { name: 'Exportovať CSV' }).click()
	await expect(dialog.getByText('Vyberte aspoň jeden jazyk.')).toBeVisible()
}

/** The 422 list of values that would break the CSV. */
const openExportWithUnsafeValues = async (page: Page) => {
	await openExport(page)
	await getExportDialog(page).getByRole('button', { name: 'Exportovať CSV' }).click()
	await expect(getExportDialog(page).getByRole('alert')).toBeVisible()
}

/** Edit translation modal of the untranslated `orders.empty.title` (en): key, language, the base language reference, the empty field and the buttons. */
const openTranslationModal = async (page: Page) => {
	await page.getByRole('button', { name: 'Preklad kľúča orders.empty.title, angličtina:' }).click()
	await expect(getEditTranslationDialog(page).getByText('Základný jazyk (slovenčina)', { exact: true })).toBeVisible()
	await expect(getTranslationField(page, 'orders.empty.title')).toBeFocused()
}

/** Edit translation modal of `dashboard.welcome` with a rejected draft (missing `{{name}}`) and the mismatch alert under the field. */
const openTranslationMismatch = async (page: Page) => {
	await page.getByRole('button', { name: 'Preklad kľúča dashboard.welcome, angličtina:' }).click()
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
	await page.getByRole('button', { name: 'Preklad kľúča cart.items, angličtina:' }).click()
	await expect(getTranslationField(page, 'cart.items', 'angličtina', 'Jeden')).toBeFocused()
	await expect(getTranslationField(page, 'cart.items', 'angličtina', 'Iné')).toHaveText('You have {{count}} items')
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
		name: 'project translations without versions',
		path: translationsWithoutVersions,
		ready: noVersionsReady,
	},
	{
		name: 'project translations of an empty version',
		path: translationsWithEmptyVersion,
		ready: emptyVersionReady,
	},
	{
		name: 'project translations diff',
		path: translationsWithDiff,
		ready: diffReady,
	},
	{
		name: 'import modal step 1',
		path: translationsWithEmptyVersion,
		ready: emptyVersionReady,
		prepare: openImportUpload,
	},
	{
		name: 'import modal step 2',
		path: translationsWithNext,
		ready: translationsRowsReady(10),
		prepare: openImportReview,
	},
	{
		name: 'export modal',
		path: translationsWithNext,
		ready: translationsRowsReady(10),
		prepare: openExport,
	},
	{
		name: 'export modal with field errors',
		path: translationsWithNext,
		ready: translationsRowsReady(10),
		prepare: openExportWithFieldErrors,
	},
	{
		name: 'export modal with unsafe values',
		path: translationsWithUnsafeValue,
		ready: translationsReady,
		prepare: openExportWithUnsafeValues,
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
		name: 'project versions',
		path: versionsWithRows,
		ready: (page) => expect(page.getByRole('table', { name: 'Zoznam verzií' }).getByRole('row')).toHaveCount(3),
	},
	{
		name: 'delete version modal',
		path: versionsWithRows,
		ready: (page) => expect(page.getByRole('table', { name: 'Zoznam verzií' }).getByRole('row')).toHaveCount(3),
		prepare: openDeleteVersionModal,
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
		name: 'project dashboard',
		path: dashboardWithData,
		ready: dashboardReady,
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
