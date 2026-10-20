import { type APIRequestContext, expect, type Page, test } from '@playwright/test'

import { ANONYMOUS } from '../support/auth'
import { listLanguages } from '../support/languages'
import { getMainNavigation } from '../support/layout'
import { createProject } from '../support/projects'
import {
	backgroundOf,
	expectKeys,
	expectStats,
	expectView,
	getCellButton,
	getColumnHeaders,
	getGroupHeaders,
	getRowStatuses,
	getSearch,
	getShownCount,
	getStat,
	getTranslationRow,
	getTranslationRows,
	getTranslationsTable,
	insertTranslationKeys,
	openTranslations,
	pickOption,
	switchView,
	type TestTranslationKey,
	translationsPath,
	TRANSPARENT,
} from '../support/translations'
import { loginAsFreshAdmin } from '../support/users'

const SENTENCE_KEY = 'Adresa nie je kompletná. Uistite sa'

const EXTENDED_HEADERS = ['Kľúč', 'slovenčina Základný', 'čeština', 'angličtina', 'Stav']

/**
 * Projects have sk (base), cs and en. Extended view (a row is translated only with every language): 1 of 5 (20 %), only `dashboard.welcome`.
 * Compact view, target `cs` (the default): 3 of 5 (60 %); target `en`: 2 of 5 (40 %).
 */
const KEYS: TestTranslationKey[] = [
	{ namespace: 'loc', name: 'orders.empty.title', values: { sk: 'Zatiaľ nemáte žiadne objednávky', cs: null, en: 'You have no orders yet' } },
	{ namespace: 'loc', name: 'orders.empty.description', values: { sk: 'Nové objednávky sa zobrazia tu.' } },
	{ namespace: 'loc', name: 'dashboard.welcome', values: { sk: 'Vitajte späť, {{name}}', cs: 'Vítejte zpět, {{name}}', en: 'Welcome back, {{ name }}' } },
	{ namespace: 'loc', name: 'promo.banner', values: { sk: 'Zľava <strong>20 %</strong>', cs: 'Sleva <strong>20 %</strong>', en: null } },
	{ namespace: 'paths', name: SENTENCE_KEY, values: { sk: 'Adresa nie je kompletná.', cs: 'Adresa není kompletní.' } },
]

const EXTENDED_UNTRANSLATED_FIRST = ['orders.empty.description', 'orders.empty.title', 'promo.banner', SENTENCE_KEY, 'dashboard.welcome']

const createProjectWithKeys = async (api: APIRequestContext, label: string, keys: TestTranslationKey[], languageTags = ['sk', 'cs', 'en']) => {
	const project = await createProject(api, label, languageTags)
	if (keys.length > 0) {
		await insertTranslationKeys(project.id, await listLanguages(api, project.id), keys)
	}
	return project
}

const expectNoLanguageSelects = async (page: Page) => {
	await expect(page.getByRole('combobox', { name: 'Zdrojový jazyk' })).toHaveCount(0)
	await expect(page.getByRole('combobox', { name: 'Cieľový jazyk' })).toHaveCount(0)
}

test('the project index redirects to Preklady, the first sidebar item, in the extended view with the stats over every language', async ({ page, request }) => {
	const project = await createProjectWithKeys(request, 'tr-overview', KEYS)

	await page.goto(`/projects/${project.slug}`)
	await expect(page).toHaveURL(translationsPath(project))
	await expect(page.getByRole('heading', { level: 1, name: 'Preklady' })).toBeVisible()
	const section = getMainNavigation(page).getByRole('list', { name: project.name })
	await expect(section.getByRole('link')).toHaveText(['Preklady', 'Prehľad', 'Nastavenia', 'Jazyky', 'Členovia'])
	await expect(section.getByRole('link', { name: 'Preklady' })).toHaveAttribute('aria-current', 'page')

	await expect(page.getByRole('button', { name: 'Importovať' })).toBeEnabled()
	await expect(page.getByRole('button', { name: 'Exportovať' })).toBeEnabled()

	await expectView(page, 'EXTENDED')
	await expectNoLanguageSelects(page)
	await expect(getStat(page, 'Celkom kľúčov')).toHaveText('5')
	await expect(getStat(page, 'Preložené')).toHaveText('1')
	await expect(getStat(page, 'Nepreložené')).toHaveText('4')
	await expect(page.getByRole('progressbar', { name: 'Preložené: 20 %' })).toBeVisible()
	await expect(page.getByRole('progressbar', { name: 'Nepreložené: 80 %' })).toBeVisible()
	await expect(getShownCount(page, 'Zobrazených 5 z 5 kľúčov')).toBeVisible()
	await expect(page.getByRole('navigation', { name: 'Stránkovanie' })).toHaveCount(0)
})

test('the extended view has a column per language, the key and status columns sticky and a horizontal scroll container', async ({ page, request }) => {
	const project = await createProjectWithKeys(request, 'tr-columns', KEYS)
	await openTranslations(page, project)

	const table = getTranslationsTable(page)
	await expect(table).toHaveAttribute('data-view', 'EXTENDED')
	await expect(getColumnHeaders(page)).toHaveText(EXTENDED_HEADERS)
	await expect(getColumnHeaders(page).nth(1).locator('[data-flag="sk"]')).toHaveCount(1)
	await expect(getColumnHeaders(page).nth(3).locator('[data-flag="gb"]')).toHaveCount(1)

	const keyHeader = getColumnHeaders(page).first()
	const statusHeader = getColumnHeaders(page).last()
	await expect(keyHeader).toHaveClass(/stickyStart/)
	await expect(statusHeader).toHaveClass(/stickyEnd/)
	expect(await keyHeader.evaluate((element) => getComputedStyle(element).position)).toBe('sticky')
	expect(await statusHeader.evaluate((element) => getComputedStyle(element).position)).toBe('sticky')
	const row = getTranslationRow(page, 'dashboard.welcome')
	await expect(row.locator('td').first()).toHaveClass(/stickyStart/)
	await expect(row.locator('td').last()).toHaveClass(/stickyEnd/)
	expect(await table.evaluate((element) => getComputedStyle(element.parentElement!).overflowX)).toBe('auto')

	// Every language of the row is a cell button; the group label stays in view while the table scrolls.
	await expect(row.getByRole('button', { name: /^Preklad kľúča dashboard\.welcome, / })).toHaveText([
		'Preklad kľúča dashboard.welcome, slovenčina: Vitajte späť, {{name}}',
		'Preklad kľúča dashboard.welcome, čeština: Vítejte zpět, {{name}}',
		'Preklad kľúča dashboard.welcome, angličtina: Welcome back, {{ name }}',
	])
	expect(
		await getGroupHeaders(page)
			.first()
			.locator('span')
			.evaluate((element) => getComputedStyle(element).position),
	).toBe('sticky')
})

test('untranslated rows come first with a badge and a red cell, never a red row; group headers split paths, not sentences', async ({ page, request }) => {
	const project = await createProjectWithKeys(request, 'tr-rows', KEYS)
	await openTranslations(page, project)

	await expectKeys(getTranslationRows(page), EXTENDED_UNTRANSLATED_FIRST)
	expect(await getRowStatuses(page)).toEqual(['UNTRANSLATED', 'UNTRANSLATED', 'UNTRANSLATED', 'UNTRANSLATED', 'TRANSLATED'])

	const untranslated = getTranslationRow(page, 'orders.empty.title')
	const translated = getTranslationRow(page, 'dashboard.welcome')
	await expect(untranslated.getByText('Nepreložené', { exact: true })).toBeVisible()
	await expect(untranslated.getByText('Bez prekladu', { exact: true })).toHaveCount(1)
	await expect(getTranslationRow(page, 'orders.empty.description').getByText('Bez prekladu', { exact: true })).toHaveCount(2)
	await expect(translated.getByText('Preložené', { exact: true })).toBeVisible()
	expect(await backgroundOf(untranslated)).toBe(TRANSPARENT)
	expect(await backgroundOf(translated)).toBe(TRANSPARENT)

	const emptyCell = getCellButton(untranslated, 'orders.empty.title', 'čeština')
	const filledCell = getCellButton(untranslated, 'orders.empty.title', 'slovenčina')
	await expect(emptyCell).toHaveAttribute('data-status', 'UNTRANSLATED')
	await expect(filledCell).toHaveAttribute('data-status', 'TRANSLATED')
	const untranslatedBackground = await backgroundOf(emptyCell)
	expect(untranslatedBackground).not.toBe(TRANSPARENT)
	expect(untranslatedBackground).not.toBe(await backgroundOf(filledCell))

	await expect(getGroupHeaders(page)).toHaveText(['loc:orders.empty', 'loc:promo', 'paths', 'loc:dashboard'])
	await expect(getTranslationRow(page, SENTENCE_KEY)).toContainText('paths')
	await expect(getTranslationsTable(page).locator('tr').nth(1)).toHaveAttribute('data-group-header')
})

test('variables show as chips and HTML as literal text', async ({ page, request }) => {
	const project = await createProjectWithKeys(request, 'tr-text', KEYS)
	await openTranslations(page, project)

	const welcome = getTranslationRow(page, 'dashboard.welcome')
	await expect(welcome.locator('code')).toHaveText(['{{name}}', '{{name}}', '{{ name }}'])
	await expect(welcome).toContainText('Vítejte zpět, {{name}}')

	const promo = getTranslationRow(page, 'promo.banner')
	await expect(promo.getByText('Zľava <strong>20 %</strong>', { exact: true })).toBeVisible()
	await expect(promo.getByText('Sleva <strong>20 %</strong>', { exact: true })).toBeVisible()
	await expect(getTranslationsTable(page).locator('strong')).toHaveCount(0)
})

test('search filters key and the text of every language, is kept in the URL and survives a reload', async ({ page, request }) => {
	const project = await createProjectWithKeys(request, 'tr-search', KEYS)
	await openTranslations(page, project)

	await getSearch(page).fill('objedn')
	await expect(page).toHaveURL(translationsPath(project, '?search=objedn'))
	await expectKeys(getTranslationRows(page), ['orders.empty.description', 'orders.empty.title'])
	await expect(getShownCount(page, 'Zobrazených 2 z 2 kľúčov')).toBeVisible()
	await expect(getStat(page, 'Celkom kľúčov')).toHaveText('5')

	await page.reload()
	await expect(getSearch(page)).toHaveValue('objedn')
	await expectKeys(getTranslationRows(page), ['orders.empty.description', 'orders.empty.title'])

	await getSearch(page).fill('Vítejte')
	await expectKeys(getTranslationRows(page), ['dashboard.welcome'])
	await getSearch(page).fill('no orders')
	await expectKeys(getTranslationRows(page), ['orders.empty.title'])
	await getSearch(page).fill('UISTITE')
	await expectKeys(getTranslationRows(page), [SENTENCE_KEY])
})

test('the status filter follows the row status over every language; status and namespace are written to the URL', async ({ page, request }) => {
	const project = await createProjectWithKeys(request, 'tr-filters', KEYS)
	await openTranslations(page, project)

	await expect(page.getByRole('combobox', { name: 'Stav' })).toHaveValue('Všetky stavy')
	await pickOption(page, 'Stav', 'Nepreložené')
	await expect(page).toHaveURL(translationsPath(project, '?status=UNTRANSLATED'))
	await expectKeys(getTranslationRows(page), ['orders.empty.description', 'orders.empty.title', 'promo.banner', SENTENCE_KEY])
	await expect(getShownCount(page, 'Zobrazených 4 z 4 kľúčov')).toBeVisible()

	await pickOption(page, 'Stav', 'Preložené')
	await expect(page).toHaveURL(translationsPath(project, '?status=TRANSLATED'))
	await expectKeys(getTranslationRows(page), ['dashboard.welcome'])

	await pickOption(page, 'Stav', 'Nepreložené')
	await pickOption(page, 'Namespace', 'paths')
	await expect(page).toHaveURL(/namespace=paths/)
	await expectKeys(getTranslationRows(page), [SENTENCE_KEY])

	await page.reload()
	await expect(page.getByRole('combobox', { name: 'Stav' })).toHaveValue('Nepreložené')
	await expect(page.getByRole('combobox', { name: 'Namespace' })).toHaveValue('paths')
	await expectKeys(getTranslationRows(page), [SENTENCE_KEY])
})

test('more than 25 keys are paginated and a single namespace has no namespace filter', async ({ page, request }) => {
	const keys = Array.from({ length: 60 }, (_, index) => {
		const name = `app.key${String(index + 1).padStart(2, '0')}`
		return { namespace: 'app', name, values: { sk: `Text ${index + 1}`, en: index % 2 === 0 ? `Text ${index + 1} EN` : null } }
	})
	const project = await createProjectWithKeys(request, 'tr-pages', keys, ['sk', 'en'])
	await openTranslations(page, project)

	await expect(page.getByRole('combobox', { name: 'Namespace' })).toHaveCount(0)
	await expect(getTranslationRows(page)).toHaveCount(25)
	await expect(getShownCount(page, 'Zobrazených 25 z 60 kľúčov')).toBeVisible()
	const pagination = page.getByRole('navigation', { name: 'Stránkovanie' })
	await expect(pagination.getByRole('button', { name: 'Predošlá' })).toBeDisabled()
	await expect(pagination.getByRole('button', { name: 'Strana 1' })).toHaveAttribute('aria-current', 'page')

	await pagination.getByRole('button', { name: 'Ďalšia' }).click()
	await expect(page).toHaveURL(translationsPath(project, '?page=2'))
	await expect(getTranslationRows(page)).toHaveCount(25)
	await expect(pagination.getByRole('button', { name: 'Strana 2' })).toHaveAttribute('aria-current', 'page')

	await pagination.getByRole('button', { name: 'Strana 3' }).click()
	await expect(page).toHaveURL(translationsPath(project, '?page=3'))
	await expect(getTranslationRows(page)).toHaveCount(10)
	await expect(getShownCount(page, 'Zobrazených 10 z 60 kľúčov')).toBeVisible()
	await expect(pagination.getByRole('button', { name: 'Strana 3' })).toHaveAttribute('aria-current', 'page')
	await expect(pagination.getByRole('button', { name: 'Ďalšia' })).toBeDisabled()
	await expect(getTranslationRows(page).first()).toHaveAttribute('data-status', 'TRANSLATED')

	await pagination.getByRole('button', { name: 'Strana 1' }).click()
	await expect(page).toHaveURL(translationsPath(project))
	await expect(getTranslationRows(page).first()).toHaveAttribute('data-status', 'UNTRANSLATED')
})

test('a project without keys shows the empty state with Importovať, which opens the import modal', async ({ page, request }) => {
	const project = await createProjectWithKeys(request, 'tr-empty', [])
	await openTranslations(page, project)

	await expect(getTranslationsTable(page).getByText('Projekt zatiaľ nemá žiadne kľúče. Pridáte ich importom súboru.')).toBeVisible()
	await getTranslationsTable(page).getByRole('button', { name: 'Importovať' }).click()
	await expect(page.getByRole('dialog', { name: 'Importovať preklady' })).toBeVisible()
	await page.keyboard.press('Escape')
	await expect(page.getByRole('dialog', { name: 'Importovať preklady' })).toHaveCount(0)
	await expect(getTranslationRows(page)).toHaveCount(0)
	await expect(getStat(page, 'Celkom kľúčov')).toHaveText('0')
})

test('no results show Zrušiť filtre, which clears search and status but keeps the rest of the URL', async ({ page, request }) => {
	const project = await createProjectWithKeys(request, 'tr-no-results', KEYS)
	await openTranslations(page, project, '?search=neexistuje&status=TRANSLATED&target=en')

	await expect(getTranslationsTable(page).getByText('Filtrom nezodpovedá žiadny kľúč.')).toBeVisible()
	await expect(getTranslationRows(page)).toHaveCount(0)
	await getTranslationsTable(page).getByRole('button', { name: 'Zrušiť filtre' }).click()

	await expect(page).toHaveURL(translationsPath(project, '?target=en'))
	await expect(getSearch(page)).toHaveValue('')
	await expect(page.getByRole('combobox', { name: 'Stav' })).toHaveValue('Všetky stavy')
	await expect(getTranslationRows(page)).toHaveCount(5)
})

// The view is saved on the user, so these tests sign in as their own ADMIN and leave the shared one in EXTENDED.
test.describe('view switch', () => {
	test.use({ storageState: ANONYMOUS })

	test('Zdroj → cieľ saves the preference, shows the language selects and the target stats, survives a reload; Všetky jazyky saves EXTENDED', async ({
		page,
		playwright,
		baseURL,
	}) => {
		await loginAsFreshAdmin(page, playwright.request, baseURL)
		const project = await createProjectWithKeys(page.request, 'tr-view', KEYS)
		await openTranslations(page, project)
		await expectView(page, 'EXTENDED')
		await expectNoLanguageSelects(page)
		expect(await (await page.request.get('/api/auth/me')).json()).toMatchObject({ preferences: { translationsView: 'EXTENDED' } })

		const compact = await switchView(page, 'COMPACT')
		expect(compact.status()).toBe(200)
		expect(await compact.json()).toMatchObject({ preferences: { translationsView: 'COMPACT' } })
		await expect(page).toHaveURL(translationsPath(project))
		await expectView(page, 'COMPACT')
		await expect(page.getByRole('combobox', { name: 'Zdrojový jazyk' })).toHaveValue('SK')
		await expect(page.getByRole('combobox', { name: 'Cieľový jazyk' })).toHaveValue('CS')
		await expect(getColumnHeaders(page)).toHaveText(['Kľúč', 'slovenčina Základný', 'čeština', 'Stav'])
		await expectStats(page, 3, 2)
		await expect(page.getByRole('progressbar', { name: 'Preložené: 60 %' })).toBeVisible()
		await expectKeys(getTranslationRows(page), ['orders.empty.description', 'orders.empty.title', 'dashboard.welcome', 'promo.banner', SENTENCE_KEY])
		expect(await getRowStatuses(page)).toEqual(['UNTRANSLATED', 'UNTRANSLATED', 'TRANSLATED', 'TRANSLATED', 'TRANSLATED'])
		// The source text is read-only; only the target cell is a button.
		await expect(getTranslationRow(page, 'dashboard.welcome').getByRole('button', { name: /^Preklad kľúča/ })).toHaveText([
			'Preklad kľúča dashboard.welcome, čeština: Vítejte zpět, {{name}}',
		])
		expect(await (await page.request.get('/api/auth/me')).json()).toMatchObject({ preferences: { translationsView: 'COMPACT' } })

		await page.reload()
		await expect(getTranslationsTable(page)).toHaveAttribute('aria-busy', 'false')
		await expectView(page, 'COMPACT')
		await expectStats(page, 3, 2)

		await pickOption(page, 'Cieľový jazyk', /^EN/)
		await expect(page).toHaveURL(translationsPath(project, '?target=en'))
		await expect(page.getByRole('combobox', { name: 'Cieľový jazyk' })).toHaveValue('EN')
		await expect(getColumnHeaders(page)).toHaveText(['Kľúč', 'slovenčina Základný', 'angličtina', 'Stav'])
		await expectStats(page, 2, 3)
		await expect(page.getByRole('progressbar', { name: 'Preložené: 40 %' })).toBeVisible()
		await expectKeys(getTranslationRows(page), ['orders.empty.description', 'promo.banner', SENTENCE_KEY, 'dashboard.welcome', 'orders.empty.title'])
		await expect(getTranslationRow(page, 'promo.banner')).toHaveAttribute('data-status', 'UNTRANSLATED')
		await expect(getTranslationRow(page, 'orders.empty.title')).toHaveAttribute('data-status', 'TRANSLATED')
		await expect(getTranslationRow(page, 'orders.empty.title')).toContainText('You have no orders yet')
		await expect(getTranslationRow(page, 'dashboard.welcome').locator('code')).toHaveText(['{{name}}', '{{ name }}'])

		// Back to every language: `target` stays in the URL and is ignored.
		const extended = await switchView(page, 'EXTENDED')
		expect(extended.status()).toBe(200)
		await expect(page).toHaveURL(translationsPath(project, '?target=en'))
		await expectNoLanguageSelects(page)
		await expect(getColumnHeaders(page)).toHaveText(EXTENDED_HEADERS)
		await expectStats(page, 1, 4)
		await expectKeys(getTranslationRows(page), EXTENDED_UNTRANSLATED_FIRST)

		await page.reload()
		await expect(getTranslationsTable(page)).toHaveAttribute('aria-busy', 'false')
		await expectView(page, 'EXTENDED')
		expect(await (await page.request.get('/api/auth/me')).json()).toMatchObject({ preferences: { translationsView: 'EXTENDED' } })
	})
})
