import { type APIRequestContext, expect, type Locator, type Page, type Request } from '@playwright/test'

import { MUTATION_HEADERS } from './api'
import { withDb } from './db'
import { type Language, listLanguages } from './languages'
import { type ProjectListItem } from './projects'
import { createProjectWithVersion, type ProjectWithVersion } from './versions'

export const projectTranslationsApi = (projectId: string) => `/api/projects/${projectId}/translations`

export const PREFERENCES_API = '/api/profile/preferences'

export type TranslationsView = 'EXTENDED' | 'COMPACT'

/** `values` per language tag: a string or `null` inserts a `Translation` row, a missing tag inserts none. */
export type TestTranslationKey = { namespace?: string; name: string; values?: Partial<Record<string, string | null>> }

/**
 * Inserts keys and translations of a version of a test project directly into the DB, so a test gets exact values and counts without an
 * import. Every key belongs to a version; the version counts as imported (`importedAt`) afterwards, as the list and Pridať kľúč need.
 * The rows cascade with the project, so the teardown deletes them with the `e2e-tmp-` projects.
 */
export const insertTranslationKeys = (projectId: string, versionId: string, languages: Language[], keys: TestTranslationKey[]) =>
	withDb(async (client) => {
		const languageIds = new Map(languages.map(({ tag, id }) => [tag, id]))
		await client.query('BEGIN')
		try {
			const inserted = await client.query<{ id: string; namespace: string; name: string }>(
				`INSERT INTO "TranslationKey" (id, "projectId", "versionId", namespace, name, "updatedAt")
				 SELECT gen_random_uuid(), $1, $2, namespace, name, now() FROM unnest($3::text[], $4::text[]) AS input(namespace, name)
				 RETURNING id, namespace, name`,
				[projectId, versionId, keys.map(({ namespace = '' }) => namespace), keys.map(({ name }) => name)],
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
			await client.query(`UPDATE "ProjectVersion" SET "importedAt" = coalesce("importedAt", now()) WHERE id = $1`, [versionId])
			await client.query('COMMIT')
		} catch (error) {
			await client.query('ROLLBACK')
			throw error
		}
	})

/** A project with sk (base), cs and en by default, one running version `v2.45` and `keys` inserted into it. */
export const createProjectWithKeys = async (
	api: APIRequestContext,
	label: string,
	keys: TestTranslationKey[],
	languageTags = ['sk', 'cs', 'en'],
): Promise<ProjectWithVersion> => {
	const project = await createProjectWithVersion(api, label, languageTags)
	if (keys.length > 0) {
		await insertTranslationKeys(project.id, project.version.id, await listLanguages(api, project.id), keys)
	}
	return project
}

export const translationApi = (projectId: string, keyId: string, languageId: string) => `/api/projects/${projectId}/keys/${keyId}/translations/${languageId}`

export const translationKeyApi = (projectId: string, keyId: string) => `/api/projects/${projectId}/keys/${keyId}`

export type TranslationKeyPlural = { variable: string } | null

export type TranslationStatus = 'TRANSLATED' | 'UNTRANSLATED'

export type TranslationCell = { value: string | null; status: TranslationStatus; updatedAt: string | null }

export type TranslationListItem = {
	keyId: string
	namespace: string
	name: string
	group: string
	description: string | null
	plural: TranslationKeyPlural
	/** Row status: by the target language with a language pair in the query, by every project language without one. */
	status: TranslationStatus
	/** A cell per project language, keyed by `ProjectLanguage.id`. */
	translations: Record<string, TranslationCell>
	/** Only with `diff=true`: the key is not in the previous version, or the languages whose value differs from it and their previous values. */
	diff?: { added: boolean; changedLanguageIds: string[]; previousValues: Record<string, string | null> }
}

export type TranslationsResponse = {
	items: TranslationListItem[]
	total: number
	page: number
	pageSize: number
	stats: { totalKeys: number; translated: number; untranslated: number; warnings: number; untranslatedByLanguage: Record<string, number> }
	namespaces: string[]
}

export type LanguagePair = { sourceLanguageId: string; targetLanguageId: string }

/**
 * `GET …/translations` of one version: with `pair` in the compact semantics (target decides the row status), without it in the extended one
 * (every language); `diff` lists only the keys added or changed against the previous version.
 */
export const listTranslations = async (api: APIRequestContext, projectId: string, versionId: string, pair?: LanguagePair, diff?: true) => {
	const response = await api.get(projectTranslationsApi(projectId), { params: { versionId, ...pair, ...(diff ? { diff: 'true' } : {}) } })
	expect(response.status(), `GET ${projectTranslationsApi(projectId)}`).toBe(200)
	return (await response.json()) as TranslationsResponse
}

export const cellOf = (item: TranslationListItem, language: Language) => item.translations[language.id]!

/** `PATCH /api/profile/preferences` as the user of `api` (`page.request` shares the cookies of the page). */
export const setTranslationsView = async (api: APIRequestContext, translationsView: TranslationsView) => {
	const response = await api.patch(PREFERENCES_API, { data: { translationsView }, headers: MUTATION_HEADERS })
	expect(response.status(), `PATCH ${PREFERENCES_API}`).toBe(200)
}

export const translationsPath = (project: ProjectListItem, query = '') => `/projects/${project.slug}/translations${query}`

export const getTranslationsTable = (page: Page) => page.getByRole('table', { name: 'Zoznam prekladov' })

export const getTranslationRows = (page: Page) => getTranslationsTable(page).locator('tr[data-status]')

export const getTranslationRow = (page: Page, key: string) => getTranslationRows(page).filter({ has: page.getByText(key, { exact: true }) })

export const getRowStatuses = (page: Page) => getTranslationRows(page).evaluateAll((rows) => rows.map((row) => row.getAttribute('data-status')))

export const getGroupHeaders = (page: Page) => getTranslationsTable(page).locator('tr[data-group-header]')

/** The number under the label of a stat card (Celkom kľúčov, Preložené, Nepreložené), without the share next to it. The label sits in a row with an optional suffix (the target language). */
export const getStat = (page: Page, label: string) =>
	page
		.locator('p')
		.filter({ hasText: new RegExp(`^${label}$`) })
		.locator('xpath=../following-sibling::*[1]/*[1]')

export const expectStats = async (page: Page, translated: number, untranslated: number) => {
	await expect(getStat(page, 'Preložené')).toHaveText(String(translated))
	await expect(getStat(page, 'Nepreložené')).toHaveText(String(untranslated))
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

export const getColumnHeaders = (page: Page) => getTranslationsTable(page).getByRole('columnheader')

/** The „Zobrazenie“ switch: radios „Všetky jazyky“ (EXTENDED) and „Zdroj → cieľ“ (COMPACT). */
export const getViewSwitch = (page: Page) => page.getByRole('radiogroup', { name: 'Zobrazenie' })

export const VIEW_LABEL: Record<TranslationsView, string> = { EXTENDED: 'Všetky jazyky', COMPACT: 'Zdroj → cieľ' }

/** The „Zobraziť len zmeny“ switch (`?diff=true`); absent for a version without an import. */
export const getDiffSwitch = (page: Page) => page.getByRole('switch', { name: 'Zobraziť len zmeny' })

/** Clicks the switch (its input sits over the track and takes the pointer) and waits for the list to settle. */
export const toggleDiff = async (page: Page, checked: boolean) => {
	await getDiffSwitch(page).click()
	await expect(getDiffSwitch(page)).toHaveJSProperty('checked', checked)
	await expect(getTranslationsTable(page)).toHaveAttribute('aria-busy', 'false')
}

/** The „Nové“ badge of an added key in the diff (its accessible text is „Nový kľúč“). */
export const getNewBadge = (row: Locator) => row.getByText('Nový kľúč', { exact: true })

export const isPreferencesPatch = (req: Request) => req.method() === 'PATCH' && req.url().endsWith(PREFERENCES_API)

/** Clicks the view radio (its label, which also works in WebKit) and resolves with the `PATCH /api/profile/preferences` response. */
export const switchView = async (page: Page, view: TranslationsView) => {
	const patched = page.waitForResponse((response) => isPreferencesPatch(response.request()))
	await getViewSwitch(page).getByText(VIEW_LABEL[view], { exact: true }).click()
	const response = await patched
	expect(response.request().postDataJSON()).toEqual({ translationsView: view })
	await expect(getTranslationsTable(page)).toHaveAttribute('data-view', view)
	await expect(getTranslationsTable(page)).toHaveAttribute('aria-busy', 'false')
	return response
}

export const expectView = async (page: Page, view: TranslationsView) => {
	await expect(getViewSwitch(page).getByRole('radio', { name: VIEW_LABEL[view] })).toBeChecked()
	await expect(getTranslationsTable(page)).toHaveAttribute('data-view', view)
}

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

export const backgroundOf = (locator: Locator) => locator.evaluate((element) => getComputedStyle(element).backgroundColor)

export const TRANSPARENT = 'rgba(0, 0, 0, 0)'

export const openTranslations = async (page: Page, project: ProjectListItem, query = '') => {
	await page.goto(translationsPath(project, query))
	await expect(getTranslationsTable(page)).toHaveAttribute('aria-busy', 'false')
}

/** A translation cell of a row: a button named `Preklad kľúča <key>, <language>: <value|Bez prekladu>` with `data-status` of the cell. */
export const getCellButton = (row: Locator, key: string, language = 'angličtina') => row.getByRole('button', { name: `Preklad kľúča ${key}, ${language}:` })

export const getEditTranslationDialog = (page: Page) => page.getByRole('dialog', { name: 'Upraviť preklad' })

/**
 * The contenteditable field of the modal (`role="textbox"`); for a plural key one per form, named with the translated form name
 * (`form`: Jeden, Málo, Veľa, Iné). Its text is the value: Playwright's text normalization drops the zero-width spaces next to chips.
 */
export const getTranslationField = (page: Page, key: string, language = 'angličtina', form?: string) =>
	getEditTranslationDialog(page).getByRole('textbox', { name: `Preklad kľúča ${key}, ${language}${form ? `, ${form}` : ''}`, exact: true })

/** Clicks the cell of `key` in `language` and waits for the modal with its (first) field focused. */
export const openEditTranslationModal = async (page: Page, key: string, language = 'angličtina', form?: string) => {
	await getCellButton(getTranslationRow(page, key), key, language).click()
	const dialog = getEditTranslationDialog(page)
	await expect(dialog).toBeVisible()
	await expect(getTranslationField(page, key, language, form)).toBeFocused()
	return dialog
}

export const isTranslationPut = (req: Request) => req.method() === 'PUT' && /\/api\/projects\/[^/]+\/keys\/[^/]+\/translations\/[^/]+$/.test(req.url())

export const waitForTranslationPut = (page: Page) => page.waitForResponse((response) => isTranslationPut(response.request()))

/** Clicks the save-and-close button of the Edit translation modal and resolves with the PUT response. It is Uložiť a zavrieť next to Uložiť a ďalší, else Uložiť. */
export const saveTranslation = async (page: Page) => {
	const saved = waitForTranslationPut(page)
	await getEditTranslationDialog(page)
		.getByRole('button', { name: /^Uložiť( a zavrieť)?$/ })
		.click()
	return saved
}

/** Locked `{{var}}`, `<tag>` and `#` chips of a field; `data-token` holds the exact source text. */
export const getChips = (field: Locator) => field.locator('[data-token]')

export const expectChips = (field: Locator, tokens: string[]) => expect(getChips(field)).toHaveText(tokens)

/** Exact serialized value of the field (text without zero-width spaces, chips by `data-token`, `<br>` as a newline); unlike `toHaveText` it keeps whitespace. */
export const fieldValue = (field: Locator) =>
	field.evaluate((root) => {
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

/** Fires a `paste` event with `text/plain` (and `text/html`, which the field must ignore) at the field, as the clipboard would. */
export const pasteInto = (field: Locator, text: string) =>
	field.evaluate((root, value) => {
		const clipboardData = new DataTransfer()
		clipboardData.setData('text/plain', value)
		clipboardData.setData('text/html', `<b>${value}</b>`)
		root.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }))
	}, text)
