import { type APIRequestContext, expect, type Page, test } from '@playwright/test'

import { BROKEN_CSV, importApi, importFile, readFixture, SAMPLE_CSV } from '../support/imports'
import { listLanguages } from '../support/languages'
import { createProject, type ProjectListItem } from '../support/projects'

/**
 * `import-sample.csv` against a project with sk (base) and en: 10 new keys; sk 9 translations + 1 `null` (legal.terms, a
 * BASE_LANGUAGE_UNTRANSLATED warning), en 7 + 3, cs 6 + 4 with one PLACEHOLDER_MISMATCH (cart.items without `{{count}}`).
 */
const SAMPLE = {
	keys: 10,
	sk: { translations: 9, untranslated: 1 },
	en: { translations: 7, untranslated: 3 },
	cs: { translations: 6, untranslated: 4 },
} as const

/** Slovak plural forms: 1, 2–4, 0 and 5+. */
const plural = (count: number, [one, few, many]: [string, string, string]) => `${count} ${count === 1 ? one : count >= 2 && count <= 4 ? few : many}`

const SUCCESS = (keys: number, created: number, updated: number) =>
	`Import dokončený: ${plural(keys, ['nový kľúč', 'nové kľúče', 'nových kľúčov'])}, ${plural(created, ['nový preklad', 'nové preklady', 'nových prekladov'])}, ${plural(updated, ['prepísaný', 'prepísané', 'prepísaných'])}.`

const translationsPath = (project: ProjectListItem, query = '') => `/projects/${project.slug}/translations${query}`

const getDialog = (page: Page) => page.getByRole('dialog', { name: 'Importovať preklady' })

const getFileInput = (page: Page) => getDialog(page).getByLabel('Súbor s prekladmi')

const getReviewTable = (page: Page) => getDialog(page).getByRole('table', { name: 'Stĺpce jazykov v súbore' })

const getColumnRow = (page: Page, tag: string) =>
	getReviewTable(page)
		.getByRole('row')
		.filter({ has: page.getByRole('combobox', { name: `Jazyk pre stĺpec ${tag}`, exact: true }) })

const getLanguageSelect = (page: Page, tag: string) => getDialog(page).getByRole('combobox', { name: `Jazyk pre stĺpec ${tag}`, exact: true })

const getSummary = (page: Page) => getDialog(page).getByRole('list', { name: 'Súhrn' })

/** The number under the label of a stat card (Celkom kľúčov, Preložené, Chýbajúce). */
const getStat = (page: Page, label: string) =>
	page
		.locator('p')
		.filter({ hasText: new RegExp(`^${label}$`) })
		.locator('xpath=following-sibling::*[1]')

const getTranslationRows = (page: Page) => page.getByRole('table', { name: 'Zoznam prekladov' }).locator('tr[data-status]')

const openImportModal = async (page: Page, project: ProjectListItem, query = '') => {
	await page.goto(translationsPath(project, query))
	await expect(page.getByRole('table', { name: 'Zoznam prekladov' })).toHaveAttribute('aria-busy', 'false')
	await page.getByRole('main').getByRole('button', { name: 'Importovať' }).first().click()
	await expect(getDialog(page)).toBeVisible()
	await expect(getDialog(page).getByText('Krok 1 z 2 · Nahratie')).toBeVisible()
}

const continueToReview = async (page: Page) => {
	await getDialog(page).getByRole('button', { name: 'Pokračovať na kontrolu' }).click()
	await expect(getDialog(page).getByText('Krok 2 z 2 · Kontrola')).toBeVisible()
	await expect(getReviewTable(page)).toBeVisible()
}

/** The row cells after the language select: tag, translations, untranslated, warnings and new / changed. */
const expectColumnStats = async (page: Page, tag: string, stats: { translations: number; untranslated: number }, warnings: number, changes: string) => {
	const cells = getColumnRow(page, tag).getByRole('cell')
	await expect(cells.nth(1)).toContainText(tag)
	await expect(cells.nth(2)).toHaveText(String(stats.translations))
	await expect(cells.nth(3)).toHaveText(String(stats.untranslated))
	await expect(cells.nth(4)).toHaveText(String(warnings))
	await expect(cells.nth(5)).toHaveText(changes)
}

const pickLanguageOption = async (page: Page, tag: string, option: string) => {
	await getLanguageSelect(page, tag).click()
	await page.getByRole('option', { name: option, exact: true }).click()
}

const importColumns = async (api: APIRequestContext, projectId: string, tags: string[], columns: Record<string, string | null>) => {
	const languages = await listLanguages(api, projectId)
	return importFile(
		api,
		projectId,
		SAMPLE_CSV,
		tags.map((tag, index) => ({
			columnIndex: index + 2,
			languageId: columns[tag] === undefined ? null : languages.find((language) => language.tag === columns[tag])!.id,
		})),
	)
}

test('imports the sample file, adds the missing language from the review and shows the result in the list', async ({ page, request }) => {
	const project = await createProject(request, 'import-happy', ['sk', 'en'])
	await openImportModal(page, project)

	await expect(getDialog(page).getByRole('button', { name: 'Pokračovať na kontrolu' })).toBeDisabled()
	await getFileInput(page).setInputFiles(SAMPLE_CSV)
	await expect(getDialog(page).getByText('import-sample.csv')).toBeVisible()
	await expect(getDialog(page).getByRole('checkbox', { name: 'Vytvoriť chýbajúce kľúče' })).toBeChecked()
	await continueToReview(page)

	await expect(getLanguageSelect(page, 'sk')).toHaveValue('Slovak (sk)')
	await expect(getLanguageSelect(page, 'en')).toHaveValue('English (en)')
	await expect(getLanguageSelect(page, 'cs')).toHaveValue('')
	const csRow = getColumnRow(page, 'cs')
	await expect(csRow).toHaveAttribute('data-undecided', 'true')
	await expect(csRow.getByText('Jazyk cs nie je v projekte.')).toBeVisible()
	await expectColumnStats(page, 'sk', SAMPLE.sk, 1, '9 / 0')
	await expectColumnStats(page, 'en', SAMPLE.en, 0, '7 / 0')
	await expectColumnStats(page, 'cs', SAMPLE.cs, 1, '—')
	await expect(getSummary(page).getByRole('listitem')).toHaveText([
		'10 nových kľúčov',
		'0 prekladov sa prepíše',
		'16 nových prekladov',
		'1 kľúč bez prekladu v základnom jazyku',
		'1 stĺpec sa preskočí',
	])

	const warningButton = getDialog(page).getByRole('button', { name: '1 upozornenie pre stĺpec cs' })
	await expect(warningButton).toHaveAttribute('aria-expanded', 'false')
	await warningButton.click()
	await expect(warningButton).toHaveAttribute('aria-expanded', 'true')
	await expect(getReviewTable(page).getByText('Upozornenia pre stĺpec cs')).toBeVisible()
	await expect(
		getReviewTable(page).getByText(/^Riadok 6, stĺpec 4: kľúč „cart\.items“ \(loc, cs\) má iné premenné.*chýba: \{\{count\}\}, navyše: –$/),
	).toBeVisible()
	await getDialog(page).getByRole('button', { name: '1 upozornenie pre stĺpec sk' }).click()
	await expect(getReviewTable(page).getByText('Riadok 9, stĺpec 2: kľúč „legal.terms“ (loc) nemá preklad v základnom jazyku sk')).toBeVisible()

	const secondPreview = page.waitForResponse(
		(response) => response.url().endsWith(`${importApi(project.id)}/preview`) && response.request().method() === 'POST',
	)
	await csRow.getByRole('button', { name: 'Pridať jazyk' }).click()
	expect((await secondPreview).status()).toBe(200)
	await expect(getLanguageSelect(page, 'cs')).toHaveValue('Czech (cs)')
	await expect(csRow).not.toHaveAttribute('data-undecided')
	await expect(csRow.getByText('Jazyk cs nie je v projekte.')).toHaveCount(0)
	await expectColumnStats(page, 'cs', SAMPLE.cs, 1, '6 / 0')
	await expect(getSummary(page).getByRole('listitem')).toHaveText([
		'10 nových kľúčov',
		'0 prekladov sa prepíše',
		'22 nových prekladov',
		'1 kľúč bez prekladu v základnom jazyku',
	])
	await expect(getDialog(page).getByText('Počty sú približné')).toHaveCount(0)

	const importRequest = page.waitForRequest((req) => req.url().endsWith(importApi(project.id)) && req.method() === 'POST')
	await getDialog(page).getByRole('button', { name: 'Importovať' }).click()
	const languages = await listLanguages(request, project.id)
	const languageId = (tag: string) => languages.find((language) => language.tag === tag)!.id
	expect((await importRequest).postDataJSON()).toEqual({
		fileName: 'import-sample.csv',
		content: readFixture(SAMPLE_CSV),
		columns: [
			{ columnIndex: 2, languageId: languageId('sk') },
			{ columnIndex: 3, languageId: languageId('en') },
			{ columnIndex: 4, languageId: languageId('cs') },
		],
		createMissingKeys: true,
	})
	await expect(page.getByText(SUCCESS(10, 22, 0))).toBeVisible()
	await expect(getDialog(page)).toHaveCount(0)

	await expect(page.getByRole('combobox', { name: 'Cieľový jazyk' })).toHaveValue('CS')
	await expect(getStat(page, 'Celkom kľúčov')).toHaveText('10')
	await expect(getStat(page, 'Preložené')).toHaveText(String(SAMPLE.cs.translations))
	await expect(getStat(page, 'Chýbajúce')).toHaveText(String(SAMPLE.cs.untranslated))
	await expect(getTranslationRows(page)).toHaveCount(10)
	const statuses = await getTranslationRows(page).evaluateAll((rows) => rows.map((row) => row.getAttribute('data-status')))
	expect(statuses).toEqual([...Array<string>(4).fill('UNTRANSLATED'), ...Array<string>(6).fill('TRANSLATED')])
	await expect(getTranslationRows(page).filter({ hasText: 'promo.banner' }).getByText('Sleva <strong>20 %</strong>', { exact: true })).toBeVisible()
	await expect(getTranslationRows(page).filter({ hasText: 'cart.items' }).locator('code')).toHaveText(['{{count}}'])

	await page.goto(translationsPath(project, '?target=en'))
	await expect(getStat(page, 'Preložené')).toHaveText(String(SAMPLE.en.translations))
	await expect(getStat(page, 'Chýbajúce')).toHaveText(String(SAMPLE.en.untranslated))

	await page.goto(`/projects/${project.slug}/languages`)
	const languagesTable = page.getByRole('table', { name: 'Zoznam jazykov' })
	await expect(languagesTable).toHaveAttribute('aria-busy', 'false')
	await expect(languagesTable.getByText('· cs')).toBeVisible()
	await expect(languagesTable.getByText('Czech', { exact: true })).toBeVisible()
})

test('a column set to Preskočiť is not imported', async ({ page, request }) => {
	const project = await createProject(request, 'import-skip', ['sk', 'en'])
	await openImportModal(page, project)
	await getFileInput(page).setInputFiles(SAMPLE_CSV)
	await continueToReview(page)

	await pickLanguageOption(page, 'en', 'Preskočiť')
	await expect(getLanguageSelect(page, 'en')).toHaveValue('Preskočiť')
	await expectColumnStats(page, 'en', SAMPLE.en, 0, '—')
	await getColumnRow(page, 'cs').getByRole('button', { name: 'Preskočiť' }).click()
	await expect(getLanguageSelect(page, 'cs')).toHaveValue('Preskočiť')
	await expect(getColumnRow(page, 'cs')).not.toHaveAttribute('data-undecided')
	await expect(getSummary(page).getByRole('listitem')).toHaveText([
		'10 nových kľúčov',
		'0 prekladov sa prepíše',
		'9 nových prekladov',
		'1 kľúč bez prekladu v základnom jazyku',
		'2 stĺpce sa preskočia',
	])

	const importRequest = page.waitForRequest((req) => req.url().endsWith(importApi(project.id)) && req.method() === 'POST')
	await getDialog(page).getByRole('button', { name: 'Importovať' }).click()
	const [sk] = await listLanguages(request, project.id)
	expect((await importRequest).postDataJSON()).toMatchObject({
		columns: [
			{ columnIndex: 2, languageId: sk!.id },
			{ columnIndex: 3, languageId: null },
			{ columnIndex: 4, languageId: null },
		],
	})
	await expect(page.getByText(SUCCESS(10, 9, 0))).toBeVisible()
	await expect(getDialog(page)).toHaveCount(0)

	await expect(page.getByRole('combobox', { name: 'Cieľový jazyk' })).toHaveValue('EN')
	await expect(getStat(page, 'Celkom kľúčov')).toHaveText('10')
	await expect(getStat(page, 'Preložené')).toHaveText('0')
	await expect(getStat(page, 'Chýbajúce')).toHaveText('10')
	await expect(getTranslationRows(page).filter({ hasText: 'nav.home' })).toContainText('Bez prekladu')
	expect((await listLanguages(request, project.id)).map(({ tag }) => tag)).toEqual(['sk', 'en'])
})

test('importing the same file again creates and overwrites nothing', async ({ page, request }) => {
	const project = await createProject(request, 'import-repeat', ['sk', 'en', 'cs'])
	expect(await importColumns(request, project.id, ['sk', 'en', 'cs'], { sk: 'sk', en: 'en', cs: 'cs' })).toEqual({
		keysCreated: 10,
		translationsCreated: 22,
		translationsUpdated: 0,
		skippedColumns: 0,
	})

	await openImportModal(page, project)
	await getFileInput(page).setInputFiles(SAMPLE_CSV)
	await continueToReview(page)
	await expect(getLanguageSelect(page, 'cs')).toHaveValue('Czech (cs)')
	await expectColumnStats(page, 'sk', SAMPLE.sk, 1, '0 / 0')
	await expectColumnStats(page, 'en', SAMPLE.en, 0, '0 / 0')
	await expectColumnStats(page, 'cs', SAMPLE.cs, 1, '0 / 0')
	await expect(getSummary(page).getByRole('listitem')).toHaveText([
		'0 nových kľúčov',
		'0 prekladov sa prepíše',
		'0 nových prekladov',
		'1 kľúč bez prekladu v základnom jazyku',
	])

	await getDialog(page).getByRole('button', { name: 'Importovať' }).click()
	await expect(page.getByText(SUCCESS(0, 0, 0))).toBeVisible()
	await expect(getDialog(page)).toHaveCount(0)
	await expect(getStat(page, 'Celkom kľúčov')).toHaveText('10')
})

test('a broken file shows its issues per line and blocks the review; another file clears them', async ({ page, request }) => {
	const project = await createProject(request, 'import-broken', ['sk', 'en'])
	await openImportModal(page, project)
	await getFileInput(page).setInputFiles(BROKEN_CSV)
	await getDialog(page).getByRole('button', { name: 'Pokračovať na kontrolu' }).click()

	const issues = getDialog(page).getByRole('alert').filter({ hasText: 'Súbor obsahuje chyby. Opravte ich a nahrajte ho znova.' })
	await expect(issues).toBeVisible()
	await expect(issues.getByRole('listitem')).toHaveText(['Riadok 3: očakávaných 3 stĺpcov, nájdených 4', 'Riadok 4, stĺpec 1: prázdny kľúč'])
	await expect(getDialog(page).getByText('Krok 1 z 2 · Nahratie')).toBeVisible()
	await expect(getReviewTable(page)).toHaveCount(0)
	await expect(getDialog(page).getByRole('button', { name: 'Importovať', exact: true })).toHaveCount(0)

	await getFileInput(page).setInputFiles(SAMPLE_CSV)
	await expect(issues).toHaveCount(0)
	await expect(getDialog(page).getByText('import-sample.csv')).toBeVisible()
	await continueToReview(page)
	await expect(getColumnRow(page, 'sk')).toBeVisible()
})

test('a file without the .csv extension is rejected locally without a request', async ({ page, request }) => {
	const project = await createProject(request, 'import-txt', ['sk', 'en'])
	await openImportModal(page, project)
	const importRequests: string[] = []
	page.on('request', (req) => {
		if (req.url().includes('/imports')) {
			importRequests.push(req.url())
		}
	})

	await getFileInput(page).setInputFiles({ name: 'import-sample.txt', mimeType: 'text/plain', buffer: Buffer.from(readFixture(SAMPLE_CSV)) })
	const error = getDialog(page).getByRole('alert')
	await expect(error).toHaveText('Podporovaný je iba súbor CSV (prípona .csv).')
	await expect(getFileInput(page)).toHaveAttribute('aria-invalid', 'true')
	await expect(getDialog(page).getByText('Presuňte súbor sem alebo kliknite pre výber')).toBeVisible()
	await expect(getDialog(page).getByRole('button', { name: 'Pokračovať na kontrolu' })).toBeDisabled()
	expect(importRequests).toEqual([])

	await getFileInput(page).setInputFiles(SAMPLE_CSV)
	await expect(error).toHaveCount(0)
	await expect(getDialog(page).getByRole('button', { name: 'Pokračovať na kontrolu' })).toBeEnabled()
})
