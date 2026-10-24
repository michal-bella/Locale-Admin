import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'

import { MUTATION_HEADERS, readApiError } from '../support/api'
import { ANONYMOUS } from '../support/auth'
import { getExportDialog } from '../support/exports'
import { importSample } from '../support/imports'
import { listLanguages, newAdminApi } from '../support/languages'
import { getMainNavigation } from '../support/layout'
import { projectMembershipApi } from '../support/projects'
import {
	getRowStatuses,
	getTranslationRow,
	getTranslationRows,
	getTranslationsTable,
	listTranslations,
	pickOption,
	translationApi,
} from '../support/translations'
import { createVisitor, loginViaApi, type TestEditor } from '../support/users'
import { createVersion, CURRENT_WINDOW, type ProjectVersion } from '../support/versions'

test.use({ storageState: ANONYMOUS })

/** A fresh VISITOR per test, member of a project with the sample keys in its current version (imported as the ADMIN); the page is signed in as them. */
const signInVisitor = async (page: Page, request: Parameters<typeof createVisitor>[0], baseURL: string | undefined) => {
	const visitor = await createVisitor(request, baseURL)
	const admin = await newAdminApi(request)
	let version: ProjectVersion
	try {
		version = await createVersion(admin, visitor.projectId, { name: 'v2.45', ...CURRENT_WINDOW })
		await importSample(admin, visitor.projectId, version.id, { sk: 'sk', en: 'en', cs: null })
	} finally {
		await admin.dispose()
	}
	await loginViaApi(page, visitor)
	return { ...visitor, version }
}

const projectPath = (visitor: TestEditor, page: string) => `/projects/${visitor.projectSlug}/${page}`

const expectForbidden = async (page: Page, path: string) => {
	await page.goto(path)
	await expect(page.getByRole('heading', { level: 1, name: 'Prístup zamietnutý' })).toBeVisible()
	await expect(page).toHaveURL(path)
}

test('sees only Preklady and Prehľad in the sidebar and the 403 page on the other project pages and on Správa', async ({ page, playwright, baseURL }) => {
	const visitor = await signInVisitor(page, playwright.request, baseURL)
	await page.goto(projectPath(visitor, 'translations'))

	const project = getMainNavigation(page).getByRole('list', { name: /^E2E visitor/ })
	await expect(project.getByRole('link')).toHaveText(['Preklady', 'Prehľad', 'História'])
	await expect(getMainNavigation(page).getByText('Správa')).toHaveCount(0)

	await page.getByRole('link', { name: 'Prehľad' }).click()
	await expect(page).toHaveURL(projectPath(visitor, 'dashboard'))
	await expect(page.getByRole('link', { name: 'Otvoriť preklady' })).toBeVisible()
	await expect(page.getByRole('list', { name: 'Stav jazykov' }).getByRole('listitem')).toHaveCount(2)
	await expect(page.getByRole('link', { name: 'Spravovať jazyky' })).toHaveCount(0)
	await expect(page.getByRole('link', { name: 'Zobraziť členov' })).toHaveCount(0)

	for (const forbidden of ['settings', 'languages', 'members']) {
		await expectForbidden(page, projectPath(visitor, forbidden))
	}
	await expectForbidden(page, '/admin/users')
})

test('reads, filters and exports the translations without any edit control, and the table passes axe', async ({ page, playwright, baseURL }, testInfo) => {
	const visitor = await signInVisitor(page, playwright.request, baseURL)
	await page.goto(projectPath(visitor, 'translations'))
	const table = getTranslationsTable(page)
	await expect(table).toHaveAttribute('aria-busy', 'false')

	const main = page.getByRole('main')
	await expect(main.getByRole('button', { name: 'Exportovať' })).toBeVisible()
	await expect(main.getByRole('button', { name: 'Importovať' })).toHaveCount(0)
	await expect(main.getByRole('button', { name: 'Pridať kľúč' })).toHaveCount(0)
	await expect(main.getByRole('button', { name: 'Vytvoriť verziu' })).toHaveCount(0)
	await expect(page.getByText('Verzia v2.45: ostáva 12 dní do uzamknutia.')).toBeVisible()
	await expect(page.getByRole('button', { name: 'Zamknúť' })).toHaveCount(0)
	await expect(getTranslationRows(page)).toHaveCount(10)
	// Cells are text: nothing in the body takes the focus and a click opens nothing.
	await expect(table.locator('tbody').locator('button, a, input, textarea, select, [tabindex]')).toHaveCount(0)
	const cell = getTranslationRow(page, 'dashboard.welcome').getByText('Preklad kľúča dashboard.welcome, angličtina:').locator('..')
	await expect(cell).toContainText('Welcome back')
	await cell.click()
	await expect(page.getByRole('dialog')).toHaveCount(0)

	// Extended view (the default of a new user): a row is untranslated when any language is, so en 3 + sk legal.terms.
	await pickOption(page, 'Stav', 'Nepreložené')
	await expect(table).toHaveAttribute('aria-busy', 'false')
	await expect(getTranslationRows(page)).toHaveCount(4)
	expect(await getRowStatuses(page)).toEqual(Array<string>(4).fill('UNTRANSLATED'))

	const { violations } = await new AxeBuilder({ page })
		.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
		.disableRules(['color-contrast'])
		.analyze()
	await testInfo.attach('axe', { body: JSON.stringify(violations, null, 2), contentType: 'application/json' })
	expect(violations.map(({ id, nodes }) => `${id}: ${nodes.map(({ target }) => target.join(' ')).join(', ')}`)).toEqual([])

	await main.getByRole('button', { name: 'Exportovať' }).click()
	await expect(getExportDialog(page).getByRole('checkbox', { name: 'Slovenčina' })).toBeChecked()
})

test('gets 403 from the API for a translation and for leaving the project, 200 for the list and the export', async ({ page, playwright, baseURL }) => {
	const visitor = await signInVisitor(page, playwright.request, baseURL)
	const api = page.request
	const [sk, en] = await listLanguages(api, visitor.projectId)
	const { items } = await listTranslations(api, visitor.projectId, visitor.version.id)
	const key = items.find(({ name }) => name === 'dashboard.welcome')!

	const put = await api.put(translationApi(visitor.projectId, key.keyId, en!.id), { data: { value: 'Changed' }, headers: MUTATION_HEADERS })
	expect(put.status()).toBe(403)
	expect((await readApiError(put)).code).toBe('FORBIDDEN')
	const leave = await api.delete(projectMembershipApi(visitor.projectId), { data: {}, headers: MUTATION_HEADERS })
	expect(leave.status()).toBe(403)

	const exported = await api.get(`/api/projects/${visitor.projectId}/export`, { params: { languageIds: sk!.id, versionId: visitor.version.id } })
	expect(exported.status()).toBe(200)
	expect(await exported.text()).toContain('Keys; sk')
	const after = await listTranslations(api, visitor.projectId, visitor.version.id)
	expect(after.items.find(({ name }) => name === 'dashboard.welcome')!.translations[en!.id]!.value).toBe(key.translations[en!.id]!.value)
})

test('has neither Nastavenia nor Opustiť projekt in the project list', async ({ page, playwright, baseURL }) => {
	await signInVisitor(page, playwright.request, baseURL)
	await page.goto('/')

	const list = page.getByRole('list', { name: 'Zoznam projektov' })
	await expect(list.getByRole('link', { name: /^E2E visitor/ })).toBeVisible()
	await expect(list.getByRole('link', { name: /^Nastavenia projektu/ })).toHaveCount(0)
	await expect(list.getByRole('button', { name: /^Opustiť projekt/ })).toHaveCount(0)
})
