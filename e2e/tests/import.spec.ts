import { expect, test } from '@playwright/test'

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
	importSample,
	importSuccessMessage,
	openImportModal,
	pickLanguageOption,
	readFixture,
	SAMPLE,
	SAMPLE_CSV,
	submitImport,
} from '../support/imports'
import { listLanguages } from '../support/languages'
import { createProject } from '../support/projects'
import { getRowStatuses, getStat, getTranslationRows, listTranslations } from '../support/translations'
import { createVersion, CURRENT_WINDOW } from '../support/versions'

test('imports the sample file, adds the missing language from the review and shows the result in the list', async ({ page, request }) => {
	const project = await createProject(request, 'import-happy', ['sk', 'en'])
	await openImportModal(page, project)

	await expect(getImportDialog(page).getByRole('button', { name: 'Pokračovať na kontrolu' })).toBeDisabled()
	await getFileInput(page).setInputFiles(SAMPLE_CSV)
	await expect(getImportDialog(page).getByText('import-sample.csv')).toBeVisible()
	await expect(getImportDialog(page).getByRole('checkbox', { name: 'Vytvoriť chýbajúce kľúče' })).toBeChecked()
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

	const warningButton = getImportDialog(page).getByRole('button', { name: '1 upozornenie pre stĺpec cs' })
	await expect(warningButton).toHaveAttribute('aria-expanded', 'false')
	await warningButton.click()
	await expect(warningButton).toHaveAttribute('aria-expanded', 'true')
	await expect(getReviewTable(page).getByText('Upozornenia pre stĺpec cs')).toBeVisible()
	await expect(
		getReviewTable(page).getByText(/^Riadok 6, stĺpec 4: kľúč „cart\.items“ \(loc, cs\) má iné premenné.*chýba: \{\{count\}\}, navyše: –$/),
	).toBeVisible()
	await getImportDialog(page).getByRole('button', { name: '1 upozornenie pre stĺpec sk' }).click()
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
	await expect(getImportDialog(page).getByText('Počty sú približné')).toHaveCount(0)

	const importRequest = submitImport(page, project.id)
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
	await expect(page.getByText(importSuccessMessage(10, 22, 0))).toBeVisible()
	await expect(getImportDialog(page)).toHaveCount(0)

	// The extended view counts a row as translated only with a value in sk, en and cs: 4 of 10.
	await expect(getStat(page, 'Celkom kľúčov')).toHaveText('10')
	await expect(getStat(page, 'Preložené')).toHaveText('4')
	await expect(getStat(page, 'Nepreložené')).toHaveText('6')
	await expect(getTranslationRows(page)).toHaveCount(10)
	expect(await getRowStatuses(page)).toEqual([...Array<string>(6).fill('UNTRANSLATED'), ...Array<string>(4).fill('TRANSLATED')])
	await expect(getTranslationRows(page).filter({ hasText: 'promo.banner' }).getByText('Sleva <strong>20 %</strong>', { exact: true })).toBeVisible()
	await expect(getTranslationRows(page).filter({ hasText: 'cart.items' }).locator('code')).toHaveText(['{{count}}', '{{count}}'])

	const en = await listTranslations(request, project.id, { sourceLanguageId: languageId('sk'), targetLanguageId: languageId('en') })
	expect(en.stats).toEqual({ totalKeys: 10, translated: SAMPLE.en.translations, untranslated: SAMPLE.en.untranslated, warnings: 1 })
	const cs = await listTranslations(request, project.id, { sourceLanguageId: languageId('sk'), targetLanguageId: languageId('cs') })
	expect(cs.stats).toEqual({ totalKeys: 10, translated: SAMPLE.cs.translations, untranslated: SAMPLE.cs.untranslated, warnings: 1 })

	await page.goto(`/projects/${project.slug}/languages`)
	const languagesTable = page.getByRole('table', { name: 'Zoznam jazykov' })
	await expect(languagesTable).toHaveAttribute('aria-busy', 'false')
	await expect(languagesTable.getByText('· cs')).toBeVisible()
	await expect(languagesTable.getByText('Čeština', { exact: true })).toBeVisible()
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

	const importRequest = submitImport(page, project.id)
	const [sk] = await listLanguages(request, project.id)
	expect((await importRequest).postDataJSON()).toMatchObject({
		columns: [
			{ columnIndex: 2, languageId: sk!.id },
			{ columnIndex: 3, languageId: null },
			{ columnIndex: 4, languageId: null },
		],
	})
	await expect(page.getByText(importSuccessMessage(10, 9, 0))).toBeVisible()
	await expect(getImportDialog(page)).toHaveCount(0)

	await expect(getStat(page, 'Celkom kľúčov')).toHaveText('10')
	await expect(getStat(page, 'Preložené')).toHaveText('0')
	await expect(getStat(page, 'Nepreložené')).toHaveText('10')
	await expect(getTranslationRows(page).filter({ hasText: 'nav.home' })).toContainText('Bez prekladu')
	expect((await listLanguages(request, project.id)).map(({ tag }) => tag)).toEqual(['sk', 'en'])
})

test('importing the same file again creates and overwrites nothing', async ({ page, request }) => {
	const project = await createProject(request, 'import-repeat', ['sk', 'en', 'cs'])
	expect(await importSample(request, project.id, { sk: 'sk', en: 'en', cs: 'cs' })).toEqual({
		keysCreated: 10,
		translationsCreated: 22,
		translationsUpdated: 0,
		skippedColumns: 0,
		version: null,
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

	await getImportDialog(page).getByRole('button', { name: 'Importovať' }).click()
	await expect(page.getByText(importSuccessMessage(0, 0, 0))).toBeVisible()
	await expect(getImportDialog(page)).toHaveCount(0)
	await expect(getStat(page, 'Celkom kľúčov')).toHaveText('10')
})

test('a broken file shows its issues per line and blocks the review; another file clears them', async ({ page, request }) => {
	const project = await createProject(request, 'import-broken', ['sk', 'en'])
	await openImportModal(page, project)
	await getFileInput(page).setInputFiles(BROKEN_CSV)
	await getImportDialog(page).getByRole('button', { name: 'Pokračovať na kontrolu' }).click()

	const issues = getImportDialog(page).getByRole('alert').filter({ hasText: 'Súbor obsahuje chyby. Opravte ich a nahrajte ho znova.' })
	await expect(issues).toBeVisible()
	await expect(issues.getByRole('listitem')).toHaveText(['Riadok 3: očakávaných 3 stĺpcov, nájdených 4', 'Riadok 4, stĺpec 1: prázdny kľúč'])
	await expect(getImportDialog(page).getByText('Krok 1 z 2 · Nahratie')).toBeVisible()
	await expect(getReviewTable(page)).toHaveCount(0)
	await expect(getImportDialog(page).getByRole('button', { name: 'Importovať', exact: true })).toHaveCount(0)

	await getFileInput(page).setInputFiles(SAMPLE_CSV)
	await expect(issues).toHaveCount(0)
	await expect(getImportDialog(page).getByText('import-sample.csv')).toBeVisible()
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
	const error = getImportDialog(page).getByRole('alert')
	await expect(error).toHaveText('Podporovaný je iba súbor CSV (prípona .csv).')
	await expect(getFileInput(page)).toHaveAttribute('aria-invalid', 'true')
	await expect(getImportDialog(page).getByText('Presuňte súbor sem alebo kliknite pre výber')).toBeVisible()
	await expect(getImportDialog(page).getByRole('button', { name: 'Pokračovať na kontrolu' })).toBeDisabled()
	expect(importRequests).toEqual([])

	await getFileInput(page).setInputFiles(SAMPLE_CSV)
	await expect(error).toHaveCount(0)
	await expect(getImportDialog(page).getByRole('button', { name: 'Pokračovať na kontrolu' })).toBeEnabled()
})

test('imports into the current version preselected in step 1; the keys then show up as the work of the version', async ({ page, request }) => {
	const project = await createProject(request, 'import-version', ['sk', 'en'])
	const version = await createVersion(request, project.id, { name: 'v2.45', ...CURRENT_WINDOW })
	await openImportModal(page, project)

	const versionSelect = getImportDialog(page).getByRole('combobox', { name: 'Verzia' })
	await expect(versionSelect).toHaveValue('v2.45 (aktuálna)')
	await getFileInput(page).setInputFiles(SAMPLE_CSV)
	await continueToReview(page)
	await expect(getSummary(page).getByRole('listitem').last()).toHaveText('Verzia: v2.45')

	const importRequest = submitImport(page, project.id)
	expect((await importRequest).postDataJSON()).toMatchObject({ versionId: version.id })
	await expect(getImportDialog(page)).toHaveCount(0)

	await page.goto(`/projects/${project.slug}/translations?version=${version.id}`)
	await expect(getTranslationRows(page)).toHaveCount(SAMPLE.keys)
	await expect(getTranslationRows(page).first().getByText('v2.45', { exact: true })).toHaveAccessibleName('Vznikol vo verzii v2.45')
	await expect(page.getByRole('combobox', { name: 'Verzia' })).toHaveValue('v2.45 (aktuálna)')
})
