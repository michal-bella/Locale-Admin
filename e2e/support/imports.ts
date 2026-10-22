import { readFileSync } from 'node:fs'
import path from 'node:path'

import { type APIRequestContext, expect, type Page } from '@playwright/test'

import { MUTATION_HEADERS } from './api'
import { listLanguages } from './languages'
import { type ProjectListItem } from './projects'
import { translationsPath } from './translations'

export const FIXTURES_DIR = path.resolve(import.meta.dirname, '../fixtures')

/** Invented GoodRequest `i18nextJsonToCsv` file: 10 keys in `loc` and `paths`, columns sk, en, cs, `null` and `""` values, placeholders. */
export const SAMPLE_CSV = path.join(FIXTURES_DIR, 'import-sample.csv')

/** Row 3 has one field too many, row 4 an empty key. */
export const BROKEN_CSV = path.join(FIXTURES_DIR, 'import-broken.csv')

/**
 * The next release of `import-sample.csv` (sk, en only): 8 of its keys (without `legal.terms` and `Vrátiť sa do obchodu`), two new ones
 * (`nav.about`, `Kontaktujte nás`), en `dashboard.welcome` changed (`{{ name }}` → `{{name}}`) and en `orders.empty.description` filled.
 */
export const NEXT_CSV = path.join(FIXTURES_DIR, 'import-next.csv')

export const readFixture = (file: string) => readFileSync(file, 'utf8')

export const importPreviewApi = (projectId: string) => `/api/projects/${projectId}/imports/preview`

export const importApi = (projectId: string) => `/api/projects/${projectId}/imports`

export type ImportColumn = { columnIndex: number; languageId: string | null }

export type ImportResult = {
	keysCreated: number
	keysCopied: number
	keysRemoved: number
	translationsCreated: number
	translationsUpdated: number
	skippedColumns: number
	version: { id: string; name: string }
}

/**
 * Imports a fixture into a version through the API as the user of `api`. `columns` follows the contract: every language column of the file
 * once. The import copies the keys of the previous version that are in the file and removes the keys of the version that are not.
 */
export const importFile = async (api: APIRequestContext, projectId: string, versionId: string, file: string, columns: ImportColumn[]) => {
	const response = await api.post(importApi(projectId), {
		data: { fileName: path.basename(file), content: readFixture(file), columns, versionId },
		headers: MUTATION_HEADERS,
	})
	expect(response.status(), `POST ${importApi(projectId)}`).toBe(200)
	return (await response.json()) as ImportResult
}

/**
 * `import-sample.csv` against a project with sk (base) and en: 10 new keys; sk 9 translations + 1 `null` (legal.terms, a
 * BASE_LANGUAGE_UNTRANSLATED warning), en 7 + 3, cs 6 + 4 with one PLACEHOLDER_MISMATCH (cart.items without `{{count}}`).
 */
export const SAMPLE = {
	keys: 10,
	columns: ['sk', 'en', 'cs'],
	sk: { translations: 9, untranslated: 1 },
	en: { translations: 7, untranslated: 3 },
	cs: { translations: 6, untranslated: 4 },
} as const

/** Imports the sample file into a version through the API; `mapping` gives the project language tag per file column (`null` = skip). */
export const importSample = async (
	api: APIRequestContext,
	projectId: string,
	versionId: string,
	mapping: Record<(typeof SAMPLE.columns)[number], string | null>,
) => {
	const languages = await listLanguages(api, projectId)
	return importFile(
		api,
		projectId,
		versionId,
		SAMPLE_CSV,
		SAMPLE.columns.map((tag, index) => ({
			columnIndex: index + 2,
			languageId: mapping[tag] === null ? null : languages.find((language) => language.tag === mapping[tag])!.id,
		})),
	)
}

/** Slovak plural forms: 1, 2–4, 0 and 5+. */
const plural = (count: number, [one, few, many]: [string, string, string]) => `${count} ${count === 1 ? one : count >= 2 && count <= 4 ? few : many}`

/** The green notification after an import; copied and removed keys are mentioned only when there are any. */
export const importSuccessMessage = (keys: number, created: number, updated: number, copied = 0, removed = 0) =>
	`Import dokončený: ${[
		plural(keys, ['nový kľúč', 'nové kľúče', 'nových kľúčov']),
		plural(created, ['nový preklad', 'nové preklady', 'nových prekladov']),
		plural(updated, ['prepísaný', 'prepísané', 'prepísaných']),
		copied > 0 &&
			plural(copied, ['kľúč prevzatý z predchádzajúcej verzie', 'kľúče prevzaté z predchádzajúcej verzie', 'kľúčov prevzatých z predchádzajúcej verzie']),
		removed > 0 && plural(removed, ['kľúč odstránený', 'kľúče odstránené', 'kľúčov odstránených']),
	]
		.filter((part) => part !== false)
		.join(', ')}.`

export const getImportDialog = (page: Page) => page.getByRole('dialog', { name: 'Importovať preklady' })

export const getFileInput = (page: Page) => getImportDialog(page).getByLabel('Súbor s prekladmi')

export const getReviewTable = (page: Page) => getImportDialog(page).getByRole('table', { name: 'Stĺpce jazykov v súbore' })

export const getLanguageSelect = (page: Page, tag: string) => getImportDialog(page).getByRole('combobox', { name: `Jazyk pre stĺpec ${tag}`, exact: true })

export const getColumnRow = (page: Page, tag: string) =>
	getReviewTable(page)
		.getByRole('row')
		.filter({ has: page.getByRole('combobox', { name: `Jazyk pre stĺpec ${tag}`, exact: true }) })

export const getSummary = (page: Page) => getImportDialog(page).getByRole('list', { name: 'Súhrn' })

/** The warning block of step 2 listing the keys of the version the import would remove (missing from the file). */
export const getRemovedList = (page: Page) => getImportDialog(page).getByRole('list', { name: /^Import odstráni / })

export const getVersionSelect = (page: Page) => getImportDialog(page).getByRole('combobox', { name: 'Verzia' })

/** Opens Preklady of `project` and the import modal in step 1 from the header button (there also for a version without an import, which has no table). */
export const openImportModal = async (page: Page, project: ProjectListItem, query = '') => {
	await page.goto(translationsPath(project, query))
	await expect(page.getByRole('combobox', { name: 'Verzia' })).not.toHaveValue('')
	await page.getByRole('main').getByRole('button', { name: 'Importovať' }).first().click()
	await expect(getImportDialog(page)).toBeVisible()
	await expect(getImportDialog(page).getByText('Krok 1 z 2 · Nahratie')).toBeVisible()
}

export const continueToReview = async (page: Page) => {
	await getImportDialog(page).getByRole('button', { name: 'Pokračovať na kontrolu' }).click()
	await expect(getImportDialog(page).getByText('Krok 2 z 2 · Kontrola')).toBeVisible()
	await expect(getReviewTable(page)).toBeVisible()
}

/** The row cells after the language select: tag, translations, untranslated, warnings and new / changed. */
export const expectColumnStats = async (page: Page, tag: string, stats: { translations: number; untranslated: number }, warnings: number, changes: string) => {
	const cells = getColumnRow(page, tag).getByRole('cell')
	await expect(cells.nth(1)).toContainText(tag)
	await expect(cells.nth(2)).toHaveText(String(stats.translations))
	await expect(cells.nth(3)).toHaveText(String(stats.untranslated))
	await expect(cells.nth(4)).toHaveText(String(warnings))
	await expect(cells.nth(5)).toHaveText(changes)
}

export const pickLanguageOption = async (page: Page, tag: string, option: string) => {
	await getLanguageSelect(page, tag).click()
	await page.getByRole('option', { name: option, exact: true }).click()
}

/** Resolves with the submitted import request once the user clicks Importovať in step 2. */
export const submitImport = async (page: Page, projectId: string) => {
	const importRequest = page.waitForRequest((req) => req.url().endsWith(importApi(projectId)) && req.method() === 'POST')
	await getImportDialog(page).getByRole('button', { name: 'Importovať' }).click()
	return importRequest
}
