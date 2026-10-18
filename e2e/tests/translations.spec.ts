import { type APIRequestContext, expect, type Locator, type Page, test } from '@playwright/test'

import { listLanguages } from '../support/languages'
import { getMainNavigation } from '../support/layout'
import { createProject, type ProjectListItem } from '../support/projects'
import { insertTranslationKeys, type TestTranslationKey } from '../support/translations'

const SENTENCE_KEY = 'Adresa nie je kompletná. Uistite sa'

/** Projects have sk (base), cs and en; the default target is cs. Target `cs`: 3 of 5 translated (60 %); target `en`: 2 of 5 (40 %). */
const KEYS: TestTranslationKey[] = [
	{ namespace: 'loc', name: 'orders.empty.title', values: { sk: 'Zatiaľ nemáte žiadne objednávky', cs: null, en: 'You have no orders yet' } },
	{ namespace: 'loc', name: 'orders.empty.description', values: { sk: 'Nové objednávky sa zobrazia tu.' } },
	{ namespace: 'loc', name: 'dashboard.welcome', values: { sk: 'Vitajte späť, {{name}}', cs: 'Vítejte zpět, {{name}}', en: 'Welcome back, {{ name }}' } },
	{ namespace: 'loc', name: 'promo.banner', values: { sk: 'Zľava <strong>20 %</strong>', cs: 'Sleva <strong>20 %</strong>', en: null } },
	{ namespace: 'paths', name: SENTENCE_KEY, values: { sk: 'Adresa nie je kompletná.', cs: 'Adresa není kompletní.' } },
]

const createProjectWithKeys = async (api: APIRequestContext, label: string, keys: TestTranslationKey[], languageTags = ['sk', 'cs', 'en']) => {
	const project = await createProject(api, label, languageTags)
	if (keys.length > 0) {
		await insertTranslationKeys(project.id, await listLanguages(api, project.id), keys)
	}
	return project
}

const translationsPath = (project: ProjectListItem, query = '') => `/projects/${project.slug}/translations${query}`

const getTable = (page: Page) => page.getByRole('table', { name: 'Zoznam prekladov' })

const getRows = (page: Page) => getTable(page).locator('tr[data-status]')

const getRow = (page: Page, key: string) => getRows(page).filter({ has: page.getByText(key, { exact: true }) })

const getGroupHeaders = (page: Page) => getTable(page).locator('tr[data-group-header]')

/** The number under the label of a stat card (Celkom kľúčov, Preložené, Chýbajúce). */
const getStat = (page: Page, label: string) =>
	page
		.locator('p')
		.filter({ hasText: new RegExp(`^${label}$`) })
		.locator('xpath=following-sibling::*[1]')

const getSearch = (page: Page) => page.getByRole('textbox', { name: 'Hľadať kľúč alebo preklad' })

const pickOption = async (page: Page, label: string, option: string | RegExp) => {
	await page.getByRole('combobox', { name: label }).click()
	await page.getByRole('option', { name: option, exact: typeof option === 'string' }).click()
}

const expectKeys = (rows: Locator, keys: string[]) => expect(rows.locator('td:first-child > span:first-child')).toHaveText(keys)

const openTranslations = async (page: Page, project: ProjectListItem, query = '') => {
	await page.goto(translationsPath(project, query))
	await expect(getTable(page)).toHaveAttribute('aria-busy', 'false')
}

test('the project index redirects to Preklady, the first sidebar item, with the stats of the target language', async ({ page, request }) => {
	const project = await createProjectWithKeys(request, 'tr-overview', KEYS)

	await page.goto(`/projects/${project.slug}`)
	await expect(page).toHaveURL(translationsPath(project))
	await expect(page.getByRole('heading', { level: 1, name: 'Preklady' })).toBeVisible()
	const section = getMainNavigation(page).getByRole('list', { name: project.name })
	await expect(section.getByRole('link')).toHaveText(['Preklady', 'Nastavenia projektu', 'Jazyky', 'Členovia'])
	await expect(section.getByRole('link', { name: 'Preklady' })).toHaveAttribute('aria-current', 'page')

	const importButton = page.getByRole('button', { name: 'Importovať' })
	await expect(importButton).toBeVisible()
	await expect(importButton).toBeDisabled()
	await expect(page.getByRole('button', { name: 'Exportovať' })).toHaveCount(0)

	await expect(page.getByRole('combobox', { name: 'Zdrojový jazyk' })).toHaveValue('SK')
	await expect(page.getByRole('combobox', { name: 'Cieľový jazyk' })).toHaveValue('CS')
	await expect(getStat(page, 'Celkom kľúčov')).toHaveText('5')
	await expect(getStat(page, 'Preložené')).toHaveText('3')
	await expect(getStat(page, 'Chýbajúce')).toHaveText('2')
	await expect(page.getByRole('progressbar', { name: 'Preložené: 60 %' })).toBeVisible()
	await expect(page.getByRole('progressbar', { name: 'Chýbajúce: 40 %' })).toBeVisible()
	await expect(page.getByText('Zobrazených 5 z 5 kľúčov')).toBeVisible()
	await expect(page.getByRole('navigation', { name: 'Stránkovanie' })).toHaveCount(0)
})

test('untranslated rows come first with a red background and badge; group headers split paths, not sentences', async ({ page, request }) => {
	const project = await createProjectWithKeys(request, 'tr-rows', KEYS)
	await openTranslations(page, project)

	await expectKeys(getRows(page), ['orders.empty.description', 'orders.empty.title', 'dashboard.welcome', 'promo.banner', SENTENCE_KEY])
	const statuses = await getRows(page).evaluateAll((rows) => rows.map((row) => row.getAttribute('data-status')))
	expect(statuses).toEqual(['UNTRANSLATED', 'UNTRANSLATED', 'TRANSLATED', 'TRANSLATED', 'TRANSLATED'])

	const untranslated = getRow(page, 'orders.empty.title')
	const translated = getRow(page, 'dashboard.welcome')
	await expect(untranslated.getByText('Nepreložené', { exact: true })).toBeVisible()
	await expect(untranslated.getByText('Bez prekladu', { exact: true })).toBeVisible()
	await expect(getRow(page, 'orders.empty.description').getByText('Bez prekladu', { exact: true })).toBeVisible()
	await expect(translated.getByText('Preložené', { exact: true })).toBeVisible()
	const background = (row: Locator) => row.evaluate((element) => getComputedStyle(element).backgroundColor)
	const untranslatedBackground = await background(untranslated)
	expect(untranslatedBackground).not.toBe('rgba(0, 0, 0, 0)')
	expect(untranslatedBackground).not.toBe(await background(translated))

	await expect(getGroupHeaders(page)).toHaveText(['loc:orders.empty', 'loc:dashboard', 'loc:promo', 'paths'])
	await expect(getRow(page, SENTENCE_KEY)).toContainText('paths')
	await expect(getTable(page).locator('tr').nth(1)).toHaveAttribute('data-group-header')
})

test('variables show as chips and HTML as literal text', async ({ page, request }) => {
	const project = await createProjectWithKeys(request, 'tr-text', KEYS)
	await openTranslations(page, project)

	const welcome = getRow(page, 'dashboard.welcome')
	await expect(welcome.locator('code')).toHaveText(['{{name}}', '{{name}}'])
	await expect(welcome).toContainText('Vítejte zpět, {{name}}')

	const promo = getRow(page, 'promo.banner')
	await expect(promo.getByText('Zľava <strong>20 %</strong>', { exact: true })).toBeVisible()
	await expect(promo.getByText('Sleva <strong>20 %</strong>', { exact: true })).toBeVisible()
	await expect(getTable(page).locator('strong')).toHaveCount(0)
})

test('search filters key and text, is kept in the URL and survives a reload', async ({ page, request }) => {
	const project = await createProjectWithKeys(request, 'tr-search', KEYS)
	await openTranslations(page, project)

	await getSearch(page).fill('objedn')
	await expect(page).toHaveURL(translationsPath(project, '?search=objedn'))
	await expectKeys(getRows(page), ['orders.empty.description', 'orders.empty.title'])
	await expect(page.getByText('Zobrazených 2 z 2 kľúčov')).toBeVisible()
	await expect(getStat(page, 'Celkom kľúčov')).toHaveText('5')

	await page.reload()
	await expect(getSearch(page)).toHaveValue('objedn')
	await expectKeys(getRows(page), ['orders.empty.description', 'orders.empty.title'])

	await getSearch(page).fill('Vítejte')
	await expectKeys(getRows(page), ['dashboard.welcome'])
	await getSearch(page).fill('UISTITE')
	await expectKeys(getRows(page), [SENTENCE_KEY])
})

test('status and namespace filters are written to the URL', async ({ page, request }) => {
	const project = await createProjectWithKeys(request, 'tr-filters', KEYS)
	await openTranslations(page, project)

	await expect(page.getByRole('combobox', { name: 'Stav' })).toHaveValue('Všetky stavy')
	await pickOption(page, 'Stav', 'Nepreložené')
	await expect(page).toHaveURL(translationsPath(project, '?status=UNTRANSLATED'))
	await expectKeys(getRows(page), ['orders.empty.description', 'orders.empty.title'])

	await pickOption(page, 'Stav', 'Preložené')
	await expect(page).toHaveURL(translationsPath(project, '?status=TRANSLATED'))
	await expectKeys(getRows(page), ['dashboard.welcome', 'promo.banner', SENTENCE_KEY])

	await pickOption(page, 'Namespace', 'paths')
	await expect(page).toHaveURL(/namespace=paths/)
	await expectKeys(getRows(page), [SENTENCE_KEY])

	await page.reload()
	await expect(page.getByRole('combobox', { name: 'Stav' })).toHaveValue('Preložené')
	await expect(page.getByRole('combobox', { name: 'Namespace' })).toHaveValue('paths')
	await expectKeys(getRows(page), [SENTENCE_KEY])
})

test('switching the target language changes the values, statuses and stats', async ({ page, request }) => {
	const project = await createProjectWithKeys(request, 'tr-target', KEYS)
	await openTranslations(page, project)
	await expect(getTable(page).getByRole('columnheader')).toContainText(['Kľúč', 'slovenčina', 'čeština', 'Stav'])

	await pickOption(page, 'Cieľový jazyk', /^EN/)
	await expect(page).toHaveURL(translationsPath(project, '?target=en'))
	await expect(page.getByRole('combobox', { name: 'Cieľový jazyk' })).toHaveValue('EN')
	await expect(getTable(page).getByRole('columnheader')).toContainText(['Kľúč', 'slovenčina', 'English', 'Stav'])
	await expect(getStat(page, 'Preložené')).toHaveText('2')
	await expect(getStat(page, 'Chýbajúce')).toHaveText('3')
	await expect(page.getByRole('progressbar', { name: 'Preložené: 40 %' })).toBeVisible()

	await expectKeys(getRows(page), ['orders.empty.description', 'promo.banner', SENTENCE_KEY, 'dashboard.welcome', 'orders.empty.title'])
	await expect(getRow(page, 'promo.banner')).toHaveAttribute('data-status', 'UNTRANSLATED')
	await expect(getRow(page, 'orders.empty.title')).toHaveAttribute('data-status', 'TRANSLATED')
	await expect(getRow(page, 'orders.empty.title')).toContainText('You have no orders yet')
	await expect(getRow(page, 'dashboard.welcome').locator('code')).toHaveText(['{{name}}', '{{ name }}'])
})

test('more than 50 keys are paginated and a single namespace has no namespace filter', async ({ page, request }) => {
	const keys = Array.from({ length: 60 }, (_, index) => {
		const name = `app.key${String(index + 1).padStart(2, '0')}`
		return { namespace: 'app', name, values: { sk: `Text ${index + 1}`, en: index % 2 === 0 ? `Text ${index + 1} EN` : null } }
	})
	const project = await createProjectWithKeys(request, 'tr-pages', keys, ['sk', 'en'])
	await openTranslations(page, project)

	await expect(page.getByRole('combobox', { name: 'Namespace' })).toHaveCount(0)
	await expect(getRows(page)).toHaveCount(50)
	await expect(page.getByText('Zobrazených 50 z 60 kľúčov')).toBeVisible()
	const pagination = page.getByRole('navigation', { name: 'Stránkovanie' })
	await expect(pagination.getByRole('button', { name: 'Predošlá' })).toBeDisabled()
	await expect(pagination.getByRole('button', { name: 'Strana 1' })).toHaveAttribute('aria-current', 'page')

	await pagination.getByRole('button', { name: 'Ďalšia' }).click()
	await expect(page).toHaveURL(translationsPath(project, '?page=2'))
	await expect(getRows(page)).toHaveCount(10)
	await expect(page.getByText('Zobrazených 10 z 60 kľúčov')).toBeVisible()
	await expect(pagination.getByRole('button', { name: 'Strana 2' })).toHaveAttribute('aria-current', 'page')
	await expect(pagination.getByRole('button', { name: 'Ďalšia' })).toBeDisabled()
	await expect(getRows(page).first()).toHaveAttribute('data-status', 'TRANSLATED')

	await pagination.getByRole('button', { name: 'Strana 1' }).click()
	await expect(page).toHaveURL(translationsPath(project))
	await expect(getRows(page).first()).toHaveAttribute('data-status', 'UNTRANSLATED')
})

test('a project without keys shows the empty state with a disabled Importovať', async ({ page, request }) => {
	const project = await createProjectWithKeys(request, 'tr-empty', [])
	await openTranslations(page, project)

	await expect(getTable(page).getByText('Projekt zatiaľ nemá žiadne kľúče. Pridáte ich importom súboru.')).toBeVisible()
	await expect(getTable(page).getByRole('button', { name: 'Importovať' })).toBeDisabled()
	await expect(getRows(page)).toHaveCount(0)
	await expect(getStat(page, 'Celkom kľúčov')).toHaveText('0')
})

test('no results show Zrušiť filtre, which clears search and status but keeps the languages', async ({ page, request }) => {
	const project = await createProjectWithKeys(request, 'tr-no-results', KEYS)
	await openTranslations(page, project, '?search=neexistuje&status=TRANSLATED&target=en')

	await expect(getTable(page).getByText('Filtrom nezodpovedá žiadny kľúč.')).toBeVisible()
	await expect(getRows(page)).toHaveCount(0)
	await getTable(page).getByRole('button', { name: 'Zrušiť filtre' }).click()

	await expect(page).toHaveURL(translationsPath(project, '?target=en'))
	await expect(getSearch(page)).toHaveValue('')
	await expect(page.getByRole('combobox', { name: 'Stav' })).toHaveValue('Všetky stavy')
	await expect(getRows(page)).toHaveCount(5)
})
