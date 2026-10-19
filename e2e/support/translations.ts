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

export type TranslationListItem = {
	keyId: string
	namespace: string
	name: string
	group: string
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

export const getSearch = (page: Page) => page.getByRole('textbox', { name: 'Hľadať kľúč alebo preklad' })

/** Picks a portalled option of a toolbar select (Stav, Namespace, Zoradenie, Zdrojový / Cieľový jazyk). */
export const pickOption = async (page: Page, label: string, option: string | RegExp) => {
	await page.getByRole('combobox', { name: label }).click()
	await page.getByRole('option', { name: option, exact: typeof option === 'string' }).click()
}

export const expectKeys = (rows: Locator, keys: string[]) => expect(rows.locator('td:first-child > span:first-child')).toHaveText(keys)

export const rowBackground = (row: Locator) => row.evaluate((element) => getComputedStyle(element).backgroundColor)

export const openTranslations = async (page: Page, project: ProjectListItem, query = '') => {
	await page.goto(translationsPath(project, query))
	await expect(getTranslationsTable(page)).toHaveAttribute('aria-busy', 'false')
}

/** The target cell of a row: a button named `Preklad kľúča <key>, <language>: <value>`. */
export const getCellButton = (row: Locator, key: string, language = 'English') => row.getByRole('button', { name: `Preklad kľúča ${key}, ${language}:` })

export const getEditor = (page: Page, key: string, language = 'English') =>
	page.getByRole('textbox', { name: `Preklad kľúča ${key}, ${language}`, exact: true })

export const openEditor = async (page: Page, key: string, language = 'English') => {
	await getCellButton(getTranslationRow(page, key), key, language).click()
	const editor = getEditor(page, key, language)
	await expect(editor).toBeFocused()
	return editor
}

export const isTranslationPut = (req: Request) => req.method() === 'PUT' && /\/api\/projects\/[^/]+\/keys\/[^/]+\/translations\/[^/]+$/.test(req.url())

export const waitForTranslationPut = (page: Page) => page.waitForResponse((response) => isTranslationPut(response.request()))
