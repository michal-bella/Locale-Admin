import { type APIRequestContext, expect, type Locator, type Page, type Request, test } from '@playwright/test'

import { MUTATION_HEADERS } from '../support/api'
import { importSample } from '../support/imports'
import { createProject, getProjectSettings, type ProjectListItem, projectSettingsApi } from '../support/projects'
import {
	expectStats,
	getCellButton,
	getEditKeyButton,
	getEditor,
	getKeyName,
	getTranslationRow,
	getTranslationRows,
	getTranslationsTable,
	isTranslationPut,
	openEditor,
	openTranslations,
	rowBackground,
	waitForTranslationPut,
} from '../support/translations'

const MISMATCH_MESSAGE = 'Premenné v preklade sa nezhodujú so základným jazykom. Chýbajú: {{name}}.'

/**
 * `import-sample.csv` with sk (base) and en, `cs` skipped: 10 keys, target en 7 translated and 3 untranslated
 * (`orders.empty.description` null, `promo.banner` "", `Vrátiť sa do obchodu` null). `dashboard.welcome` has `{{name}}` in sk.
 */
const EN = { translated: 7, untranslated: 3 } as const

const seedProject = async (api: APIRequestContext, label: string) => {
	const project = await createProject(api, label, ['sk', 'en'])
	await importSample(api, project.id, { sk: 'sk', en: 'en', cs: null })
	return project
}

const openTranslationsEn = async (page: Page, project: ProjectListItem) => {
	await openTranslations(page, project, '?target=en')
	await expect(page.getByRole('combobox', { name: 'Cieľový jazyk' })).toHaveValue('EN')
}

/** Collects every PUT of a translation so a test can assert that Esc sends nothing. */
const trackPuts = (page: Page) => {
	const puts: Request[] = []
	page.on('request', (req) => {
		if (isTranslationPut(req)) {
			puts.push(req)
		}
	})
	return puts
}

test('Ctrl+Enter saves an untranslated key: PUT { value }, the row turns translated, the cards update and a reload keeps it', async ({ page, request }) => {
	const project = await seedProject(request, 'edit-save')
	await openTranslationsEn(page, project)
	await expectStats(page, EN.translated, EN.untranslated)
	const key = 'orders.empty.description'
	const row = getTranslationRow(page, key)
	await expect(row).toHaveAttribute('data-status', 'UNTRANSLATED')
	const untranslatedBackground = await rowBackground(row)
	await expect(getCellButton(row, key)).toHaveAccessibleName(`Preklad kľúča ${key}, English: Bez prekladu`)

	const editor = await openEditor(page, key)
	await expect(editor).toHaveText('')
	await expect(editor).toHaveAccessibleDescription('Uložiť: Ctrl+Enter alebo klik mimo pole. Zrušiť: Esc. Premenné a HTML značky sú zamknuté, mažú sa celé.')
	await editor.fill('New orders will appear here.')
	const saved = waitForTranslationPut(page)
	await page.keyboard.press('Control+Enter')
	const response = await saved
	expect(response.status()).toBe(200)
	expect(response.request().postDataJSON()).toEqual({ value: 'New orders will appear here.' })
	expect(await response.json()).toEqual({ value: 'New orders will appear here.', status: 'TRANSLATED', updatedAt: expect.any(String) })

	await expect(editor).toHaveCount(0)
	await expect(getCellButton(row, key)).toHaveAccessibleName(`Preklad kľúča ${key}, English: New orders will appear here.`)
	await expect(getCellButton(row, key)).toBeFocused()
	await expect(row.getByText('Preložené', { exact: true })).toBeVisible()
	await expect(row).toHaveAttribute('data-status', 'TRANSLATED')
	expect(await rowBackground(row)).not.toBe(untranslatedBackground)
	await expectStats(page, EN.translated + 1, EN.untranslated - 1)
	await expect(getTranslationRows(page).first()).not.toContainText(key)

	await page.reload()
	await expect(getTranslationsTable(page)).toHaveAttribute('aria-busy', 'false')
	await expect(getTranslationRow(page, key)).toHaveAttribute('data-status', 'TRANSLATED')
	await expect(getTranslationRow(page, key)).toContainText('New orders will appear here.')
	await expectStats(page, EN.translated + 1, EN.untranslated - 1)
})

test('blur saves, Esc restores without a request and an emptied field saves null', async ({ page, request }) => {
	const project = await seedProject(request, 'edit-blur')
	await openTranslationsEn(page, project)
	const puts = trackPuts(page)

	const blurred = await openEditor(page, 'promo.banner')
	await blurred.fill('Discount <strong>20 %</strong>')
	const blurSave = waitForTranslationPut(page)
	await page.getByRole('heading', { level: 1, name: 'Preklady' }).click()
	expect((await blurSave).request().postDataJSON()).toEqual({ value: 'Discount <strong>20 %</strong>' })
	await expect(blurred).toHaveCount(0)
	await expect(getTranslationRow(page, 'promo.banner').getByText('Discount <strong>20 %</strong>', { exact: true })).toBeVisible()
	await expect(getTranslationRow(page, 'promo.banner')).toHaveAttribute('data-status', 'TRANSLATED')
	await expectStats(page, EN.translated + 1, EN.untranslated - 1)
	await expect(getCellButton(getTranslationRow(page, 'promo.banner'), 'promo.banner')).not.toBeFocused()

	const escaped = await openEditor(page, 'Vrátiť sa do obchodu')
	await escaped.fill('Back to the shop')
	await page.keyboard.press('Escape')
	await expect(escaped).toHaveCount(0)
	await expect(getCellButton(getTranslationRow(page, 'Vrátiť sa do obchodu'), 'Vrátiť sa do obchodu')).toBeFocused()
	await expect(getTranslationRow(page, 'Vrátiť sa do obchodu').getByText('Bez prekladu', { exact: true })).toBeVisible()
	await expect(getTranslationRow(page, 'Vrátiť sa do obchodu')).toHaveAttribute('data-status', 'UNTRANSLATED')
	expect(puts).toHaveLength(1)

	const cleared = await openEditor(page, 'nav.home')
	await expect(cleared).toHaveText('Home')
	await cleared.fill('   ')
	const clearSave = waitForTranslationPut(page)
	await page.getByRole('heading', { level: 1, name: 'Preklady' }).click()
	const response = await clearSave
	expect(response.request().postDataJSON()).toEqual({ value: null })
	expect(await response.json()).toEqual({ value: null, status: 'UNTRANSLATED', updatedAt: expect.any(String) })
	await expect(getTranslationRow(page, 'nav.home').getByText('Bez prekladu', { exact: true })).toBeVisible()
	await expect(getTranslationRow(page, 'nav.home').getByText('Nepreložené', { exact: true })).toBeVisible()
	await expect(getTranslationRow(page, 'nav.home')).toHaveAttribute('data-status', 'UNTRANSLATED')
	await expectStats(page, EN.translated, EN.untranslated)
	expect(puts).toHaveLength(2)
})

test('a missing {{name}} shows the mismatch alert and keeps the draft; the fix saves; without protectVariables it saves as is', async ({ page, request }) => {
	const project = await seedProject(request, 'edit-placeholders')
	await openTranslationsEn(page, project)
	const key = 'dashboard.welcome'
	const row = getTranslationRow(page, key)
	await expect(row.locator('code')).toHaveText(['{{name}}', '{{ name }}'])

	const editor = await openEditor(page, key)
	await expect(editor).toHaveText('Welcome back, {{ name }}')
	await editor.fill('Welcome back, friend')
	const rejected = waitForTranslationPut(page)
	await page.keyboard.press('Control+Enter')
	expect((await rejected).status()).toBe(400)
	const alert = page.getByRole('alert')
	await expect(alert).toHaveText(MISMATCH_MESSAGE)
	await expect(editor).toBeVisible()
	await expect(editor).toHaveText('Welcome back, friend')
	await expect(editor).toHaveAttribute('aria-invalid', 'true')
	await expect(row).toHaveAttribute('data-status', 'TRANSLATED')
	await expectStats(page, EN.translated, EN.untranslated)

	await editor.fill('Welcome back, {{name}}')
	const accepted = waitForTranslationPut(page)
	await page.keyboard.press('Control+Enter')
	expect((await accepted).status()).toBe(200)
	await expect(editor).toHaveCount(0)
	await expect(alert).toHaveCount(0)
	await expect(row.locator('code')).toHaveText(['{{name}}', '{{name}}'])
	await expect(row).toContainText('Welcome back, {{name}}')

	const settings = await getProjectSettings(request, project.id)
	const patched = await request.patch(projectSettingsApi(project.id), {
		data: { name: settings.name, slug: settings.slug, primaryColor: settings.primaryColor, protectVariables: false },
		headers: MUTATION_HEADERS,
	})
	expect(patched.status()).toBe(200)

	const unprotected = await openEditor(page, key)
	await unprotected.fill('Welcome back, friend')
	const saved = waitForTranslationPut(page)
	await page.keyboard.press('Control+Enter')
	expect((await saved).status()).toBe(200)
	await expect(unprotected).toHaveCount(0)
	await expect(page.getByRole('alert')).toHaveCount(0)
	await expect(row.locator('code')).toHaveText(['{{name}}'])
	await expect(row).toContainText('Welcome back, friend')
})

test('Tab moves between target cells of consecutive rows, Enter opens the editor and Esc returns focus to the cell', async ({ page, request, browserName }) => {
	// WebKit keeps the Safari default: plain Tab skips buttons, Option+Tab reaches every focusable element.
	const tab = browserName === 'webkit' ? 'Alt+Tab' : 'Tab'
	const project = await seedProject(request, 'edit-keyboard')
	await openTranslationsEn(page, project)
	const puts = trackPuts(page)
	const keyOf = async (row: Locator) => (await getKeyName(row).textContent())!
	const firstRow = getTranslationRows(page).nth(0)
	const secondRow = getTranslationRows(page).nth(1)
	const firstKey = await keyOf(firstRow)
	const secondKey = await keyOf(secondRow)
	await expect(firstRow).toHaveAttribute('data-status', 'UNTRANSLATED')
	await expect(secondRow).toHaveAttribute('data-status', 'UNTRANSLATED')

	await getCellButton(firstRow, firstKey).click()
	await page.keyboard.press('Escape')
	await expect(getCellButton(firstRow, firstKey)).toBeFocused()

	// As an ADMIN every row starts with the Upraviť kľúč button, so the next target cell is two stops away.
	await page.keyboard.press(tab)
	await expect(getEditKeyButton(secondRow, secondKey)).toBeFocused()
	await page.keyboard.press(tab)
	await expect(getCellButton(secondRow, secondKey)).toBeFocused()

	await page.keyboard.press('Enter')
	const editor = getEditor(page, secondKey)
	await expect(editor).toBeFocused()
	await expect(editor).toHaveText('')

	await page.keyboard.press('Escape')
	await expect(editor).toHaveCount(0)
	await expect(getCellButton(secondRow, secondKey)).toBeFocused()

	await page.keyboard.press(`Shift+${tab}`)
	await expect(getEditKeyButton(secondRow, secondKey)).toBeFocused()
	await page.keyboard.press(`Shift+${tab}`)
	await expect(getCellButton(firstRow, firstKey)).toBeFocused()
	expect(puts).toEqual([])
})
