import { type APIRequestContext, expect, type Locator, type Page, type Request } from '@playwright/test'

import { withDb } from './db'
import { type Language } from './languages'
import { type ProjectListItem } from './projects'

export const projectTranslationsApi = (projectId: string) => `/api/projects/${projectId}/translations`

/** `values` per language tag: a string or `null` inserts a `Translation` row, a missing tag inserts none. */
export type TestTranslationKey = { namespace?: string; name: string; values?: Partial<Record<string, string | null>> }

/**
 * Inserts keys and translations of a test project directly into the DB: there is no API to create keys before the import milestone.
 * The rows cascade with the project, so the teardown deletes them with the `e2e-tmp-` projects.
 */
export const insertTranslationKeys = (projectId: string, languages: Language[], keys: TestTranslationKey[]) =>
	withDb(async (client) => {
		const languageIds = new Map(languages.map(({ tag, id }) => [tag, id]))
		await client.query('BEGIN')
		try {
			const inserted = await client.query<{ id: string; namespace: string; name: string }>(
				`INSERT INTO "TranslationKey" (id, "projectId", namespace, name, "updatedAt")
				 SELECT gen_random_uuid(), $1, namespace, name, now() FROM unnest($2::text[], $3::text[]) AS input(namespace, name)
				 RETURNING id, namespace, name`,
				[projectId, keys.map(({ namespace = '' }) => namespace), keys.map(({ name }) => name)],
			)
			const keyIds = new Map(inserted.rows.map(({ id, namespace, name }) => [`${namespace}\u0000${name}`, id]))
			const rows = keys.flatMap(({ namespace = '', name, values = {} }) =>
				Object.entries(values).map(([tag, value]) => {
					const languageId = languageIds.get(tag)
					if (!languageId) {
						throw new Error(`Language ${tag} is not in project ${projectId}`)
					}
					return { keyId: keyIds.get(`${namespace}\u0000${name}`)!, languageId, value: value ?? null }
				}),
			)
			await client.query(
				`INSERT INTO "Translation" ("keyId", "languageId", value, "updatedAt")
				 SELECT "keyId", "languageId", value, now() FROM unnest($1::uuid[], $2::uuid[], $3::text[]) AS input("keyId", "languageId", value)`,
				[rows.map(({ keyId }) => keyId), rows.map(({ languageId }) => languageId), rows.map(({ value }) => value)],
			)
			await client.query('COMMIT')
		} catch (error) {
			await client.query('ROLLBACK')
			throw error
		}
	})

export const translationApi = (projectId: string, keyId: string, languageId: string) => `/api/projects/${projectId}/keys/${keyId}/translations/${languageId}`

export const translationKeyApi = (projectId: string, keyId: string) => `/api/projects/${projectId}/keys/${keyId}`

export type TranslationKeyPlural = { variable: string } | null

export type TranslationListItem = {
	keyId: string
	namespace: string
	name: string
	group: string
	description: string | null
	plural: TranslationKeyPlural
	source: { value: string | null }
	target: { value: string | null; status: 'TRANSLATED' | 'UNTRANSLATED'; updatedAt: string | null }
}

export type TranslationsResponse = {
	items: TranslationListItem[]
	total: number
	page: number
	pageSize: number
	stats: { totalKeys: number; translated: number; untranslated: number }
	namespaces: string[]
}

export const listTranslations = async (api: APIRequestContext, projectId: string, sourceLanguageId: string, targetLanguageId: string) => {
	const response = await api.get(projectTranslationsApi(projectId), { params: { sourceLanguageId, targetLanguageId } })
	expect(response.status(), `GET ${projectTranslationsApi(projectId)}`).toBe(200)
	return (await response.json()) as TranslationsResponse
}

export const translationsPath = (project: ProjectListItem, query = '') => `/projects/${project.slug}/translations${query}`

export const getTranslationsTable = (page: Page) => page.getByRole('table', { name: 'Zoznam prekladov' })

export const getTranslationRows = (page: Page) => getTranslationsTable(page).locator('tr[data-status]')

export const getTranslationRow = (page: Page, key: string) => getTranslationRows(page).filter({ has: page.getByText(key, { exact: true }) })

export const getGroupHeaders = (page: Page) => getTranslationsTable(page).locator('tr[data-group-header]')

/** The number under the label of a stat card (Celkom kľúčov, Preložené, Chýbajúce). */
export const getStat = (page: Page, label: string) =>
	page
		.locator('p')
		.filter({ hasText: new RegExp(`^${label}$`) })
		.locator('xpath=following-sibling::*[1]')

export const expectStats = async (page: Page, translated: number, untranslated: number) => {
	await expect(getStat(page, 'Preložené')).toHaveText(String(translated))
	await expect(getStat(page, 'Chýbajúce')).toHaveText(String(untranslated))
}

/** The visible „Zobrazených X z Y kľúčov“ paragraph; the hidden `role="status"` live region repeats the same text, so `getByText` alone is ambiguous. */
export const getShownCount = (page: Page, text: string) => page.locator('p').filter({ hasText: new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) })

export const getSearch = (page: Page) => page.getByRole('textbox', { name: 'Hľadať kľúč alebo preklad' })

/** Picks a portalled option of a toolbar select (Stav, Namespace, Zoradenie, Zdrojový / Cieľový jazyk). */
export const pickOption = async (page: Page, label: string, option: string | RegExp) => {
	await page.getByRole('combobox', { name: label }).click()
	await page.getByRole('option', { name: option, exact: typeof option === 'string' }).click()
}

/** The key name of a row: the first span of the key cell's first line (the edit button of an ADMIN is its sibling). */
export const getKeyName = (rows: Locator) => rows.locator('td:first-child > div > span:first-child')

export const expectKeys = (rows: Locator, keys: string[]) => expect(getKeyName(rows)).toHaveText(keys)

/** `Upraviť kľúč <key>` pencil of a row (ADMIN only). */
export const getEditKeyButton = (row: Locator, key: string) => row.getByRole('button', { name: `Upraviť kľúč ${key}`, exact: true })

export const getEditKeyDialog = (page: Page) => page.getByRole('dialog', { name: 'Upraviť kľúč' })

export const openEditKeyModal = async (page: Page, key: string) => {
	await getEditKeyButton(getTranslationRow(page, key), key).click()
	const dialog = getEditKeyDialog(page)
	await expect(dialog).toBeVisible()
	return dialog
}

export const isTranslationKeyPatch = (req: Request) => req.method() === 'PATCH' && /\/api\/projects\/[^/]+\/keys\/[^/]+$/.test(req.url())

export const waitForTranslationKeyPatch = (page: Page) => page.waitForResponse((response) => isTranslationKeyPatch(response.request()))

/** Submits the Edit key modal and resolves with the PATCH response. */
export const submitEditKey = async (page: Page) => {
	const patched = waitForTranslationKeyPatch(page)
	await getEditKeyDialog(page).getByRole('button', { name: 'Uložiť' }).click()
	return patched
}

export const rowBackground = (row: Locator) => row.evaluate((element) => getComputedStyle(element).backgroundColor)

export const openTranslations = async (page: Page, project: ProjectListItem, query = '') => {
	await page.goto(translationsPath(project, query))
	await expect(getTranslationsTable(page)).toHaveAttribute('aria-busy', 'false')
}

/** The target cell of a row: a button named `Preklad kľúča <key>, <language>: <value>`. */
export const getCellButton = (row: Locator, key: string, language = 'English') => row.getByRole('button', { name: `Preklad kľúča ${key}, ${language}:` })

/**
 * The contenteditable editor of a cell (`role="textbox"`); for a plural key one per form, named with the translated form name
 * (`form`: Jeden, Málo, Veľa, Iné). Its text is the value: Playwright's text normalization drops the zero-width spaces next to chips.
 */
export const getEditor = (page: Page, key: string, language = 'English', form?: string) =>
	page.getByRole('textbox', { name: `Preklad kľúča ${key}, ${language}${form ? `, ${form}` : ''}`, exact: true })

export const openEditor = async (page: Page, key: string, language = 'English', form?: string) => {
	await getCellButton(getTranslationRow(page, key), key, language).click()
	const editor = getEditor(page, key, language, form)
	await expect(editor).toBeFocused()
	return editor
}

/** Locked `{{var}}`, `<tag>` and `#` chips of an editor; `data-token` holds the exact source text. */
export const getChips = (editor: Locator) => editor.locator('[data-token]')

export const expectChips = (editor: Locator, tokens: string[]) => expect(getChips(editor)).toHaveText(tokens)

/** Exact serialized value of the editor (text without zero-width spaces, chips by `data-token`, `<br>` as a newline); unlike `toHaveText` it keeps whitespace. */
export const editorValue = (editor: Locator) =>
	editor.evaluate((root) => {
		const walk = (node: Node): string => {
			if (node.nodeType === Node.TEXT_NODE) {
				return (node.textContent ?? '').replace(/\u200b/g, '')
			}
			const element = node as HTMLElement
			if (element.hasAttribute('data-token')) {
				return element.getAttribute('data-token') ?? ''
			}
			if (element.tagName === 'BR') {
				return element.hasAttribute('data-filler') ? '' : '\n'
			}
			return Array.from(node.childNodes).map(walk).join('')
		}
		return walk(root)
	})

/** Fires a `paste` event with `text/plain` (and `text/html`, which the editor must ignore) at the editor, as the clipboard would. */
export const pasteInto = (editor: Locator, text: string) =>
	editor.evaluate((root, value) => {
		const clipboardData = new DataTransfer()
		clipboardData.setData('text/plain', value)
		clipboardData.setData('text/html', `<b>${value}</b>`)
		root.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }))
	}, text)

export const isTranslationPut = (req: Request) => req.method() === 'PUT' && /\/api\/projects\/[^/]+\/keys\/[^/]+\/translations\/[^/]+$/.test(req.url())

export const waitForTranslationPut = (page: Page) => page.waitForResponse((response) => isTranslationPut(response.request()))
