import { type APIRequestContext, expect, type Locator, type Page, type Request, test } from '@playwright/test'

import { MUTATION_HEADERS } from '../support/api'
import { ANONYMOUS } from '../support/auth'
import { importSample } from '../support/imports'
import { getProjectSettings, projectSettingsApi } from '../support/projects'
import {
	backgroundOf,
	expectStats,
	expectView,
	getCellButton,
	getEditKeyButton,
	getEditTranslationDialog,
	getKeyName,
	getTranslationField,
	getTranslationRow,
	getTranslationRows,
	getTranslationsTable,
	isTranslationPut,
	openEditTranslationModal,
	openTranslations,
	saveTranslation,
	setTranslationsView,
	TRANSPARENT,
} from '../support/translations'
import { loginAsFreshAdmin } from '../support/users'
import { createProjectWithVersion } from '../support/versions'

const MISMATCH_MESSAGE = 'Premenné v preklade sa nezhodujú so základným jazykom. Chýbajú: {{name}}.'
const LOCKED_HINT = 'Premenné a HTML značky sú zamknuté, mažú sa celé.'
const SK = 'slovenčina'

/**
 * `import-sample.csv` with sk (base) and en, `cs` skipped: 10 keys. Target en: 7 translated, 3 untranslated (`orders.empty.description` null,
 * `promo.banner` "", `Vrátiť sa do obchodu` null). `legal.terms` has en but no sk, so the extended view (every language) has 6 / 4.
 * `dashboard.welcome` has `{{name}}` in sk.
 */
const EXTENDED = { translated: 6, untranslated: 4 } as const
const COMPACT_EN = { translated: 7, untranslated: 3 } as const

const seedProject = async (api: APIRequestContext, label: string) => {
	const project = await createProjectWithVersion(api, label, ['sk', 'en'])
	await importSample(api, project.id, project.version.id, { sk: 'sk', en: 'en', cs: null })
	return project
}

/** Collects every PUT of a translation so a test can assert that Zrušiť and Esc send nothing. */
const trackPuts = (page: Page) => {
	const puts: Request[] = []
	page.on('request', (req) => {
		if (isTranslationPut(req)) {
			puts.push(req)
		}
	})
	return puts
}

/** Opens the modal from the keyboard: WebKit does not focus a button on click, so only this way has a trigger for the focus to return to. */
const openWithKeyboard = async (page: Page, cell: Locator, key: string, language = 'angličtina') => {
	await cell.focus()
	await page.keyboard.press('Enter')
	await expect(getEditTranslationDialog(page)).toBeVisible()
	const field = getTranslationField(page, key, language)
	await expect(field).toBeFocused()
	return field
}

test('a click on a cell opens the modal with the key, the language and the base language value; Uložiť saves and the cell, the row and the cards update', async ({
	page,
	request,
	browserName,
}) => {
	const project = await seedProject(request, 'edit-save')
	await openTranslations(page, project)
	await expectView(page, 'EXTENDED')
	await expectStats(page, EXTENDED.translated, EXTENDED.untranslated)
	const key = 'orders.empty.description'
	const row = getTranslationRow(page, key)
	const enCell = getCellButton(row, key)
	const skCell = getCellButton(row, key, SK)
	await expect(row).toHaveAttribute('data-status', 'UNTRANSLATED')
	expect(await backgroundOf(row)).toBe(TRANSPARENT)
	await expect(enCell).toHaveAccessibleName(`Preklad kľúča ${key}, angličtina: Bez prekladu`)
	await expect(enCell).toHaveAttribute('data-status', 'UNTRANSLATED')
	await expect(skCell).toHaveAttribute('data-status', 'TRANSLATED')
	const untranslatedBackground = await backgroundOf(enCell)
	expect(untranslatedBackground).not.toBe(TRANSPARENT)
	expect(untranslatedBackground).not.toBe(await backgroundOf(skCell))

	const dialog = await openEditTranslationModal(page, key)
	await expect(dialog.getByText('Kľúč', { exact: true })).toBeVisible()
	await expect(dialog.getByText(key, { exact: true })).toBeVisible()
	await expect(dialog.getByText('Preklad (angličtina)', { exact: true })).toBeVisible()
	await expect(dialog.getByText('Základný jazyk (slovenčina)', { exact: true })).toBeVisible()
	await expect(dialog.getByText('Nové objednávky sa zobrazia tu.', { exact: true })).toBeVisible()
	const field = getTranslationField(page, key)
	await expect(field).toHaveText('')
	await expect(field).toHaveAccessibleDescription(LOCKED_HINT)
	await expect(dialog.getByRole('button', { name: 'Zrušiť' })).toBeVisible()

	await field.fill('New orders will appear here.')
	const response = await saveTranslation(page)
	expect(response.status()).toBe(200)
	expect(response.request().postDataJSON()).toEqual({ value: 'New orders will appear here.' })
	expect(await response.json()).toEqual({
		value: 'New orders will appear here.',
		status: 'TRANSLATED',
		updatedAt: expect.any(String),
		updatedBy: { id: expect.any(String), name: expect.any(String) },
	})

	await expect(dialog).toHaveCount(0)
	await expect(enCell).toHaveAccessibleName(`Preklad kľúča ${key}, angličtina: New orders will appear here.`)
	await expect(enCell).toHaveAttribute('data-status', 'TRANSLATED')
	expect(await backgroundOf(enCell)).not.toBe(untranslatedBackground)
	if (browserName !== 'webkit') {
		await expect(enCell).toBeFocused()
	}
	await expect(row.getByText('Preložené', { exact: true })).toBeVisible()
	await expect(row).toHaveAttribute('data-status', 'TRANSLATED')
	await expectStats(page, EXTENDED.translated + 1, EXTENDED.untranslated - 1)
	await expect(getTranslationRows(page).first()).not.toContainText(key)

	// The base language is a cell too: its modal has no reference block, and the row is translated once every language has a value.
	const baseKey = 'legal.terms'
	const baseRow = getTranslationRow(page, baseKey)
	await expect(baseRow).toHaveAttribute('data-status', 'UNTRANSLATED')
	await expect(getCellButton(baseRow, baseKey)).toHaveAttribute('data-status', 'TRANSLATED')
	await expect(getCellButton(baseRow, baseKey, SK)).toHaveAttribute('data-status', 'UNTRANSLATED')
	const baseDialog = await openEditTranslationModal(page, baseKey, SK)
	await expect(baseDialog.getByText(`Preklad (${SK})`, { exact: true })).toBeVisible()
	await expect(baseDialog.getByText(/^Základný jazyk/)).toHaveCount(0)
	await getTranslationField(page, baseKey, SK).fill('Obchodné podmienky')
	const baseResponse = await saveTranslation(page)
	expect(baseResponse.request().postDataJSON()).toEqual({ value: 'Obchodné podmienky' })
	expect(baseResponse.status()).toBe(200)
	await expect(baseDialog).toHaveCount(0)
	await expect(baseRow).toHaveAttribute('data-status', 'TRANSLATED')
	await expect(getCellButton(baseRow, baseKey, SK)).toHaveAccessibleName(`Preklad kľúča ${baseKey}, ${SK}: Obchodné podmienky`)
	await expectStats(page, EXTENDED.translated + 2, EXTENDED.untranslated - 2)

	await page.reload()
	await expect(getTranslationsTable(page)).toHaveAttribute('aria-busy', 'false')
	await expect(getTranslationRow(page, key)).toHaveAttribute('data-status', 'TRANSLATED')
	await expect(getTranslationRow(page, key)).toContainText('New orders will appear here.')
	await expect(getTranslationRow(page, baseKey)).toContainText('Obchodné podmienky')
	await expectStats(page, EXTENDED.translated + 2, EXTENDED.untranslated - 2)
})

test('Zrušiť and Esc close without a request and drop the draft, the focus returns to the cell, an emptied field saves null', async ({ page, request }) => {
	const project = await seedProject(request, 'edit-cancel')
	await openTranslations(page, project)
	const puts = trackPuts(page)

	const cancelled = await openEditTranslationModal(page, 'promo.banner')
	await getTranslationField(page, 'promo.banner').fill('Discount <strong>20 %</strong>')
	await cancelled.getByRole('button', { name: 'Zrušiť' }).click()
	await expect(cancelled).toHaveCount(0)
	await expect(getTranslationRow(page, 'promo.banner').getByText('Bez prekladu', { exact: true })).toBeVisible()
	await expect(getTranslationRow(page, 'promo.banner')).toHaveAttribute('data-status', 'UNTRANSLATED')
	expect(puts).toEqual([])

	await openEditTranslationModal(page, 'promo.banner')
	await expect(getTranslationField(page, 'promo.banner')).toHaveText('')
	await page.keyboard.press('Escape')
	await expect(getEditTranslationDialog(page)).toHaveCount(0)

	const key = 'Vrátiť sa do obchodu'
	const cell = getCellButton(getTranslationRow(page, key), key)
	const escaped = await openWithKeyboard(page, cell, key)
	await escaped.fill('Back to the shop')
	await page.keyboard.press('Escape')
	await expect(getEditTranslationDialog(page)).toHaveCount(0)
	await expect(cell).toBeFocused()
	await expect(cell).toHaveAccessibleName(`Preklad kľúča ${key}, angličtina: Bez prekladu`)
	expect(puts).toEqual([])

	const row = getTranslationRow(page, 'nav.home')
	await expect(row).toHaveAttribute('data-status', 'TRANSLATED')
	await openEditTranslationModal(page, 'nav.home')
	const cleared = getTranslationField(page, 'nav.home')
	await expect(cleared).toHaveText('Home')
	await cleared.fill('   ')
	const response = await saveTranslation(page)
	expect(response.request().postDataJSON()).toEqual({ value: null })
	expect(await response.json()).toEqual({
		value: null,
		status: 'UNTRANSLATED',
		updatedAt: expect.any(String),
		updatedBy: { id: expect.any(String), name: expect.any(String) },
	})
	await expect(getEditTranslationDialog(page)).toHaveCount(0)
	await expect(getCellButton(row, 'nav.home')).toHaveAccessibleName('Preklad kľúča nav.home, angličtina: Bez prekladu')
	await expect(getCellButton(row, 'nav.home')).toHaveAttribute('data-status', 'UNTRANSLATED')
	await expect(getCellButton(row, 'nav.home', SK)).toHaveAttribute('data-status', 'TRANSLATED')
	await expect(row.getByText('Nepreložené', { exact: true })).toBeVisible()
	await expect(row).toHaveAttribute('data-status', 'UNTRANSLATED')
	expect(await backgroundOf(row)).toBe(TRANSPARENT)
	await expectStats(page, EXTENDED.translated - 1, EXTENDED.untranslated + 1)
	expect(puts).toHaveLength(1)
})

test('a missing {{name}} shows the mismatch alert and keeps the modal open with the draft; the fix saves; without protectVariables it saves as is', async ({
	page,
	request,
}) => {
	const project = await seedProject(request, 'edit-placeholders')
	await openTranslations(page, project)
	const key = 'dashboard.welcome'
	const row = getTranslationRow(page, key)
	await expect(row.locator('code')).toHaveText(['{{name}}', '{{ name }}'])

	const dialog = await openEditTranslationModal(page, key)
	const field = getTranslationField(page, key)
	await expect(field).toHaveText('Welcome back, {{ name }}')
	await field.fill('Welcome back, friend')
	const rejected = await saveTranslation(page)
	expect(rejected.status()).toBe(400)
	const alert = dialog.getByRole('alert')
	await expect(alert).toHaveText(MISMATCH_MESSAGE)
	await expect(dialog).toBeVisible()
	await expect(field).toHaveText('Welcome back, friend')
	await expect(field).toHaveAttribute('aria-invalid', 'true')
	await expect(field).toHaveAccessibleDescription(`${LOCKED_HINT} ${MISMATCH_MESSAGE}`)
	await expect(row).toHaveAttribute('data-status', 'TRANSLATED')
	await expect(row).toContainText('Welcome back, {{ name }}')
	await expectStats(page, EXTENDED.translated, EXTENDED.untranslated)

	await field.fill('Welcome back, {{name}}')
	await expect(alert).toHaveCount(0)
	const accepted = await saveTranslation(page)
	expect(accepted.status()).toBe(200)
	await expect(dialog).toHaveCount(0)
	await expect(row.locator('code')).toHaveText(['{{name}}', '{{name}}'])
	await expect(row).toContainText('Welcome back, {{name}}')

	const settings = await getProjectSettings(request, project.id)
	const patched = await request.patch(projectSettingsApi(project.id), {
		data: { name: settings.name, slug: settings.slug, primaryColor: settings.primaryColor, protectVariables: false },
		headers: MUTATION_HEADERS,
	})
	expect(patched.status()).toBe(200)

	await openEditTranslationModal(page, key)
	await getTranslationField(page, key).fill('Welcome back, friend')
	const saved = await saveTranslation(page)
	expect(saved.status()).toBe(200)
	await expect(getEditTranslationDialog(page)).toHaveCount(0)
	// Only the mismatch alert of the modal: the saved value now has a placeholder warning, which the page's yellow banner reports.
	await expect(page.getByRole('alert').filter({ hasText: 'nezhodujú' })).toHaveCount(0)
	await expect(row.locator('code')).toHaveText(['{{name}}'])
	await expect(row).toContainText('Welcome back, friend')
})

test('Tab moves through the cells of consecutive rows, Enter opens the modal and Esc returns the focus to the cell', async ({ page, request, browserName }) => {
	// WebKit keeps the Safari default: plain Tab skips buttons, Option+Tab reaches every focusable element.
	const tab = browserName === 'webkit' ? 'Alt+Tab' : 'Tab'
	const project = await seedProject(request, 'edit-keyboard')
	await openTranslations(page, project)
	const puts = trackPuts(page)
	const keyOf = async (row: Locator) => (await getKeyName(row).textContent())!
	const firstRow = getTranslationRows(page).nth(0)
	const secondRow = getTranslationRows(page).nth(1)
	const firstKey = await keyOf(firstRow)
	const secondKey = await keyOf(secondRow)

	await openWithKeyboard(page, getCellButton(firstRow, firstKey), firstKey)
	await page.keyboard.press('Escape')
	await expect(getEditTranslationDialog(page)).toHaveCount(0)
	await expect(getCellButton(firstRow, firstKey)).toBeFocused()

	// As an ADMIN every row starts with the Upraviť kľúč button, then one cell per language (sk, en).
	await page.keyboard.press(tab)
	await expect(getEditKeyButton(secondRow, secondKey)).toBeFocused()
	await page.keyboard.press(tab)
	await expect(getCellButton(secondRow, secondKey, SK)).toBeFocused()
	await page.keyboard.press(tab)
	await expect(getCellButton(secondRow, secondKey)).toBeFocused()

	await page.keyboard.press('Enter')
	const field = getTranslationField(page, secondKey)
	await expect(field).toBeFocused()
	await page.keyboard.press('Escape')
	await expect(getEditTranslationDialog(page)).toHaveCount(0)
	await expect(getCellButton(secondRow, secondKey)).toBeFocused()

	await page.keyboard.press(`Shift+${tab}`)
	await expect(getCellButton(secondRow, secondKey, SK)).toBeFocused()
	await page.keyboard.press(`Shift+${tab}`)
	await expect(getEditKeyButton(secondRow, secondKey)).toBeFocused()
	await page.keyboard.press(`Shift+${tab}`)
	await expect(getCellButton(firstRow, firstKey)).toBeFocused()
	expect(puts).toEqual([])
})

// The view is saved on the user, so a test that needs the compact view signs in as its own ADMIN and leaves the shared one in EXTENDED.
test.describe('compact view', () => {
	test.use({ storageState: ANONYMOUS })

	test('only the target cell is a button, the modal shows the base language and the status follows the target language', async ({
		page,
		playwright,
		baseURL,
	}) => {
		await loginAsFreshAdmin(page, playwright.request, baseURL)
		await setTranslationsView(page.request, 'COMPACT')
		const project = await seedProject(page.request, 'edit-compact')
		await openTranslations(page, project, '?target=en')
		await expectView(page, 'COMPACT')
		await expect(page.getByRole('combobox', { name: 'Cieľový jazyk' })).toHaveValue('EN')
		await expectStats(page, COMPACT_EN.translated, COMPACT_EN.untranslated)
		// `legal.terms` has no sk value: untranslated in the extended view, translated for the target en.
		await expect(getTranslationRow(page, 'legal.terms')).toHaveAttribute('data-status', 'TRANSLATED')

		const key = 'orders.empty.description'
		const row = getTranslationRow(page, key)
		await expect(row).toHaveAttribute('data-status', 'UNTRANSLATED')
		await expect(row.getByRole('button', { name: /^Preklad kľúča/ })).toHaveCount(1)
		await expect(row.getByText('Nové objednávky sa zobrazia tu.', { exact: true })).toBeVisible()
		await expect(getCellButton(row, key)).toHaveAttribute('data-status', 'UNTRANSLATED')
		expect(await backgroundOf(row)).toBe(TRANSPARENT)

		const dialog = await openEditTranslationModal(page, key)
		await expect(dialog.getByText('Základný jazyk (slovenčina)', { exact: true })).toBeVisible()
		await expect(dialog.getByText('Nové objednávky sa zobrazia tu.', { exact: true })).toBeVisible()
		await getTranslationField(page, key).fill('New orders will appear here.')
		const response = await saveTranslation(page)
		expect(response.status()).toBe(200)
		expect(response.request().postDataJSON()).toEqual({ value: 'New orders will appear here.' })
		await expect(dialog).toHaveCount(0)
		await expect(row).toHaveAttribute('data-status', 'TRANSLATED')
		await expect(getCellButton(row, key)).toHaveAccessibleName(`Preklad kľúča ${key}, angličtina: New orders will appear here.`)
		await expectStats(page, COMPACT_EN.translated + 1, COMPACT_EN.untranslated - 1)

		await page.reload()
		await expect(getTranslationsTable(page)).toHaveAttribute('aria-busy', 'false')
		await expectView(page, 'COMPACT')
		await expect(getTranslationRow(page, key)).toContainText('New orders will appear here.')
	})
})
