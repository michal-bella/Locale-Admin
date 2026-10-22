import { expect, test } from '@playwright/test'

import { ANONYMOUS } from '../support/auth'
import {
	BROKEN_CSV,
	continueToReview,
	expectColumnStats,
	getColumnRow,
	getFileInput,
	getImportDialog,
	getLanguageSelect,
	getReviewTable,
	getSummary,
	importApi,
	importPreviewApi,
	importSample,
	importSuccessMessage,
	SAMPLE,
	SAMPLE_CSV,
	submitImport,
} from '../support/imports'
import { listLanguages, reorderLanguages } from '../support/languages'
import { createProject } from '../support/projects'
import {
	expectKeys,
	expectStats,
	expectView,
	getCellButton,
	getColumnHeaders,
	getRowStatuses,
	getSearch,
	getShownCount,
	getStat,
	getTranslationField,
	getTranslationRow,
	getTranslationRows,
	getTranslationsTable,
	listTranslations,
	openEditTranslationModal,
	openTranslations,
	pickOption,
	saveTranslation,
	switchView,
	translationsPath,
} from '../support/translations'
import { loginAsFreshAdmin } from '../support/users'
import { createProjectWithVersion, CURRENT_WINDOW, fillVersionForm, getVersionFormDialog, listVersions } from '../support/versions'

const CS = 'čeština'

/** Extended view of the sample in sk, en and cs: a row is translated only with a value in all three languages. */
const EXTENDED_ALL = { translated: 4, untranslated: 6 } as const

/** Extended view of the sample in sk and en only (`legal.terms` has no sk value). */
const EXTENDED_SK_EN = { translated: 6, untranslated: 4 } as const

/** Keys of `import-sample.csv` in the order of the list (untranslated first, then by group and name). */
const EXTENDED_UNTRANSLATED_FIRST = [
	'legal.terms',
	'orders.empty.description',
	'orders.empty.title',
	'promo.banner',
	'Adresa nie je kompletná. Uistite sa',
	'Vrátiť sa do obchodu',
	'cart.items',
	'dashboard.welcome',
	'nav.home',
	'Pokračovať do pokladne',
]

const CS_UNTRANSLATED_FIRST = [
	'legal.terms',
	'orders.empty.description',
	'orders.empty.title',
	'Adresa nie je kompletná. Uistite sa',
	'cart.items',
	'dashboard.welcome',
	'nav.home',
	'promo.banner',
	'Pokračovať do pokladne',
	'Vrátiť sa do obchodu',
]

const BY_KEY = [
	'cart.items',
	'dashboard.welcome',
	'legal.terms',
	'nav.home',
	'orders.empty.description',
	'orders.empty.title',
	'promo.banner',
	'Adresa nie je kompletná. Uistite sa',
	'Pokračovať do pokladne',
	'Vrátiť sa do obchodu',
]

const statuses = (count: number, untranslated: number) => [
	...Array<string>(untranslated).fill('UNTRANSLATED'),
	...Array<string>(count - untranslated).fill('TRANSLATED'),
]

// The flow switches the view, which is saved on the user, so it signs in as its own ADMIN and leaves the shared one in EXTENDED.
test.describe('as a fresh ADMIN', () => {
	test.use({ storageState: ANONYMOUS })

	test('a new project: create the first version, import with a missing language, switch to Zdroj → cieľ, translate in the modal, filter, sort, reload and re-import', async ({
		page,
		playwright,
		baseURL,
	}) => {
		await loginAsFreshAdmin(page, playwright.request, baseURL)
		const project = await createProject(page.request, 'flow', ['sk', 'en'])
		await page.goto(translationsPath(project))
		const main = page.getByRole('main')

		// Without a version there is nothing to import into: the page offers to create one, and switches to it right away.
		await expect(main.getByText('Projekt zatiaľ nemá žiadnu verziu. Vytvorte ju a importujte do nej preklady.')).toBeVisible()
		await expect(getStat(page, 'Celkom kľúčov')).toHaveText('0')
		await main.getByRole('button', { name: 'Vytvoriť verziu' }).click()
		const versionDialog = getVersionFormDialog(page, 'create')
		await fillVersionForm(versionDialog, { name: 'v2.45', ...CURRENT_WINDOW })
		await versionDialog.getByRole('button', { name: 'Vytvoriť' }).click()
		await expect(page.getByText('Verzia v2.45 bola vytvorená.')).toBeVisible()
		const [version] = await listVersions(page.request, project.id)
		await expect(page).toHaveURL(translationsPath(project, `?version=${version!.id}`))
		await expect(page.getByRole('combobox', { name: 'Verzia' })).toHaveValue('v2.45 (aktuálna)')
		await expect(main.getByText('Verzia v2.45 zatiaľ nemá import. Importujte do nej preklady.').first()).toBeVisible()
		await expect(page.getByText('Verzia v2.45: ostáva 12 dní do uzamknutia.')).toBeVisible()
		await main.getByRole('button', { name: 'Importovať' }).last().click()
		await expect(getImportDialog(page)).toBeVisible()
		await expect(getImportDialog(page).getByText('Krok 1 z 2 · Nahratie')).toBeVisible()
		await expect(getImportDialog(page).getByRole('combobox', { name: 'Verzia' })).toHaveValue('v2.45 (aktuálna)')

		await getFileInput(page).setInputFiles(SAMPLE_CSV)
		await expect(getImportDialog(page).getByText('import-sample.csv')).toBeVisible()
		await continueToReview(page)
		await expect(getLanguageSelect(page, 'sk')).toHaveValue('Slovak (sk)')
		await expect(getLanguageSelect(page, 'en')).toHaveValue('English (en)')
		const csRow = getColumnRow(page, 'cs')
		await expect(csRow).toHaveAttribute('data-undecided', 'true')
		await expect(csRow.getByText('Jazyk cs nie je v projekte.')).toBeVisible()
		await expect(getSummary(page).getByRole('listitem')).toContainText(['10 nových kľúčov', '16 nových prekladov', '1 stĺpec sa preskočí'])

		const secondPreview = page.waitForResponse(
			(response) => response.url().endsWith(importPreviewApi(project.id)) && response.request().method() === 'POST',
		)
		await csRow.getByRole('button', { name: 'Pridať jazyk' }).click()
		expect((await secondPreview).status()).toBe(200)
		await expect(getLanguageSelect(page, 'cs')).toHaveValue('Czech (cs)')
		await expect(csRow).not.toHaveAttribute('data-undecided')
		await expectColumnStats(page, 'cs', SAMPLE.cs, 1, '6 / 0')
		await expect(getSummary(page).getByRole('listitem')).toHaveText([
			'10 nových kľúčov',
			'0 prekladov sa prepíše',
			'22 nových prekladov',
			'1 kľúč bez prekladu v základnom jazyku',
			'Verzia: v2.45',
		])
		expect((await listLanguages(page.request, project.id)).map(({ tag }) => tag).sort()).toEqual(['cs', 'en', 'sk'])

		expect((await submitImport(page, project.id)).postDataJSON()).toMatchObject({
			fileName: 'import-sample.csv',
			createMissingKeys: true,
			versionId: version!.id,
		})
		await expect(page.getByText(importSuccessMessage(10, 22, 0))).toBeVisible()
		await expect(getImportDialog(page)).toHaveCount(0)

		// The new language is the last column right away; the row status counts every language. The version stays in the URL.
		await expect(getTranslationsTable(page)).toHaveAttribute('aria-busy', 'false')
		await expectView(page, 'EXTENDED')
		await expect(getColumnHeaders(page)).toHaveText(['Kľúč', 'slovenčina Základný', 'angličtina', CS, 'Stav'])
		await expect(page.getByText('Prvá verzia projektu.')).toBeVisible()
		await expect(getStat(page, 'Celkom kľúčov')).toHaveText('10')
		await expectStats(page, EXTENDED_ALL.translated, EXTENDED_ALL.untranslated)
		await expect(page.getByRole('progressbar', { name: 'Preložené: 40 %' })).toBeVisible()
		await expect(getShownCount(page, 'Zobrazených 10 z 10 kľúčov')).toBeVisible()
		await expectKeys(getTranslationRows(page), EXTENDED_UNTRANSLATED_FIRST)
		expect(await getRowStatuses(page)).toEqual(statuses(10, EXTENDED_ALL.untranslated))

		// Zdroj → cieľ targets the first language after the base; the flow translates Czech.
		await reorderLanguages(page.request, project.id, ['sk', 'cs', 'en'])
		await page.reload()
		await expect(getColumnHeaders(page)).toHaveText(['Kľúč', 'slovenčina Základný', CS, 'angličtina', 'Stav'])

		await switchView(page, 'COMPACT')
		await expect(page).toHaveURL(translationsPath(project, `?version=${version!.id}`))
		await expect(page.getByRole('combobox', { name: 'Zdrojový jazyk' })).toHaveValue('SK')
		await expect(page.getByRole('combobox', { name: 'Cieľový jazyk' })).toHaveValue('CS')
		await expect(getColumnHeaders(page)).toHaveText(['Kľúč', 'slovenčina Základný', CS, 'Stav'])
		await expectStats(page, SAMPLE.cs.translations, SAMPLE.cs.untranslated)
		await expect(page.getByRole('progressbar', { name: 'Preložené: 60 %' })).toBeVisible()
		await expect(page.getByRole('progressbar', { name: 'Nepreložené: 40 %' })).toBeVisible()
		await expectKeys(getTranslationRows(page), CS_UNTRANSLATED_FIRST)
		expect(await getRowStatuses(page)).toEqual(statuses(10, SAMPLE.cs.untranslated))
		await expect(getTranslationRow(page, 'nav.home')).toContainText('Domů')

		const key = 'orders.empty.title'
		const row = getTranslationRow(page, key)
		await expect(getCellButton(row, key, CS)).toHaveAccessibleName(`Preklad kľúča ${key}, ${CS}: Bez prekladu`)
		const dialog = await openEditTranslationModal(page, key, CS)
		await expect(dialog.getByText('Zatiaľ nemáte žiadne objednávky', { exact: true })).toBeVisible()
		await getTranslationField(page, key, CS).fill('Zatím nemáte žádné objednávky')
		const response = await saveTranslation(page)
		expect(response.status()).toBe(200)
		expect(response.request().postDataJSON()).toEqual({ value: 'Zatím nemáte žádné objednávky' })
		await expect(dialog).toHaveCount(0)
		await expect(row).toHaveAttribute('data-status', 'TRANSLATED')
		await expect(row.getByText('Preložené', { exact: true })).toBeVisible()
		await expect(row).toContainText('Zatím nemáte žádné objednávky')
		await expectStats(page, SAMPLE.cs.translations + 1, SAMPLE.cs.untranslated - 1)
		await expect(page.getByRole('progressbar', { name: 'Preložené: 70 %' })).toBeVisible()

		await getSearch(page).fill(key)
		await expect(page).toHaveURL(/[?&]search=orders\.empty\.title(&|$)/)
		await expectKeys(getTranslationRows(page), [key])
		await expect(getShownCount(page, 'Zobrazených 1 z 1 kľúča')).toBeVisible()
		await getSearch(page).clear()
		await expect(page).toHaveURL(translationsPath(project, `?version=${version!.id}`))
		await expect(getTranslationRows(page)).toHaveCount(10)

		await pickOption(page, 'Zoradenie', 'Podľa kľúča')
		await expect(page).toHaveURL(translationsPath(project, `?version=${version!.id}&sort=KEY`))
		await expectKeys(getTranslationRows(page), BY_KEY)

		await page.reload()
		await expect(getTranslationsTable(page)).toHaveAttribute('aria-busy', 'false')
		await expect(page).toHaveURL(translationsPath(project, `?version=${version!.id}&sort=KEY`))
		await expectView(page, 'COMPACT')
		await expect(page.getByRole('combobox', { name: 'Cieľový jazyk' })).toHaveValue('CS')
		await expect(page.getByRole('combobox', { name: 'Zoradenie' })).toHaveValue('Podľa kľúča')
		await expectKeys(getTranslationRows(page), BY_KEY)
		await expect(getTranslationRow(page, key)).toHaveAttribute('data-status', 'TRANSLATED')

		await page.goto(`/projects/${project.slug}/languages`)
		const languagesTable = page.getByRole('table', { name: 'Zoznam jazykov' })
		await expect(languagesTable).toHaveAttribute('aria-busy', 'false')
		await expect(languagesTable.getByText('· cs')).toBeVisible()
		await expect(languagesTable.getByText('Čeština', { exact: true })).toBeVisible()

		await openTranslations(page, project)
		await expectView(page, 'COMPACT')
		await page.getByRole('main').getByRole('button', { name: 'Importovať' }).click()
		await getFileInput(page).setInputFiles(SAMPLE_CSV)
		await continueToReview(page)
		await expect(getLanguageSelect(page, 'cs')).toHaveValue('Czech (cs)')
		await expectColumnStats(page, 'cs', SAMPLE.cs, 1, '0 / 0')
		await expect(getSummary(page).getByRole('listitem')).toContainText(['0 nových kľúčov', '0 prekladov sa prepíše', '0 nových prekladov'])
		await expect(getImportDialog(page).getByText(/^Import odstráni/)).toHaveCount(0)
		await submitImport(page, project.id)
		await expect(page.getByText(importSuccessMessage(0, 0, 0))).toBeVisible()
		await expect(getImportDialog(page)).toHaveCount(0)
		await expect(getStat(page, 'Celkom kľúčov')).toHaveText('10')
		await expectStats(page, SAMPLE.cs.translations + 1, SAMPLE.cs.untranslated - 1)
		await expect(getTranslationRow(page, key)).toContainText('Zatím nemáte žádné objednávky')
	})
})

test('a broken file shows its issues with line numbers and imports nothing', async ({ page, request }) => {
	const project = await createProjectWithVersion(request, 'flow-broken', ['sk', 'en'])
	await importSample(request, project.id, project.version.id, { sk: 'sk', en: 'en', cs: null })
	await openTranslations(page, project)
	await expect(getStat(page, 'Celkom kľúčov')).toHaveText('10')
	await expectStats(page, EXTENDED_SK_EN.translated, EXTENDED_SK_EN.untranslated)
	const importRequests: string[] = []
	page.on('request', (req) => {
		if (req.url().endsWith(importApi(project.id)) && req.method() === 'POST') {
			importRequests.push(req.url())
		}
	})

	await page.getByRole('main').getByRole('button', { name: 'Importovať' }).click()
	await getFileInput(page).setInputFiles(BROKEN_CSV)
	await getImportDialog(page).getByRole('button', { name: 'Pokračovať na kontrolu' }).click()
	const issues = getImportDialog(page).getByRole('alert').filter({ hasText: 'Súbor obsahuje chyby. Opravte ich a nahrajte ho znova.' })
	await expect(issues).toBeVisible()
	await expect(issues.getByRole('listitem')).toHaveText(['Riadok 3: očakávaných 3 stĺpcov, nájdených 4', 'Riadok 4, stĺpec 1: prázdny kľúč'])
	await expect(getImportDialog(page).getByText('Krok 1 z 2 · Nahratie')).toBeVisible()
	await expect(getReviewTable(page)).toHaveCount(0)

	await getImportDialog(page).getByRole('button', { name: 'Zrušiť' }).click()
	await expect(getImportDialog(page)).toHaveCount(0)
	expect(importRequests).toEqual([])
	await expect(getStat(page, 'Celkom kľúčov')).toHaveText('10')
	await expectStats(page, EXTENDED_SK_EN.translated, EXTENDED_SK_EN.untranslated)
	await expect(getTranslationRows(page)).toHaveCount(10)

	const languages = await listLanguages(request, project.id)
	const languageId = (tag: string) => languages.find((language) => language.tag === tag)!.id
	const compact = await listTranslations(request, project.id, project.version.id, { sourceLanguageId: languageId('sk'), targetLanguageId: languageId('en') })
	expect(compact.stats).toMatchObject({ totalKeys: 10, translated: SAMPLE.en.translations, untranslated: SAMPLE.en.untranslated, warnings: 0 })
	expect(compact.items.map(({ name }) => name)).not.toContain('')
	const extended = await listTranslations(request, project.id, project.version.id)
	expect(extended.stats).toMatchObject({ totalKeys: 10, translated: EXTENDED_SK_EN.translated, untranslated: EXTENDED_SK_EN.untranslated, warnings: 0 })
})
