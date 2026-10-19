import { type APIRequestContext, expect, type Locator, type Page, type Request, test } from '@playwright/test'

import { MUTATION_HEADERS, readApiError } from '../support/api'
import { STORAGE_STATE } from '../support/auth'
import { importSample } from '../support/imports'
import { listLanguages } from '../support/languages'
import { createProject, getProjectSettings, type ProjectListItem, projectSettingsApi } from '../support/projects'
import {
	editorValue,
	expectChips,
	getCellButton,
	getChips,
	getEditKeyButton,
	getEditor,
	getGroupHeaders,
	getTranslationRow,
	getTranslationRows,
	getTranslationsTable,
	isTranslationKeyPatch,
	isTranslationPut,
	listTranslations,
	openEditKeyModal,
	openEditor,
	openTranslations,
	pasteInto,
	submitEditKey,
	translationKeyApi,
	waitForTranslationPut,
} from '../support/translations'

const SAVE = 'ControlOrMeta+Enter'

/** `import-sample.csv` with sk (base) and en, `cs` skipped; see `SAMPLE` in `support/imports.ts`. */
const seedProject = async (api: APIRequestContext, label: string) => {
	const project = await createProject(api, label, ['sk', 'en'])
	await importSample(api, project.id, { sk: 'sk', en: 'en', cs: null })
	return project
}

const openTranslationsEn = async (page: Page, project: ProjectListItem) => {
	await openTranslations(page, project, '?target=en')
	await expect(page.getByRole('combobox', { name: 'Cieľový jazyk' })).toHaveValue('EN')
}

const setProtectVariables = async (api: APIRequestContext, projectId: string, protectVariables: boolean) => {
	const settings = await getProjectSettings(api, projectId)
	const response = await api.patch(projectSettingsApi(projectId), {
		data: { name: settings.name, slug: settings.slug, primaryColor: settings.primaryColor, protectVariables },
		headers: MUTATION_HEADERS,
	})
	expect(response.status()).toBe(200)
}

const trackRequests = (page: Page, matches: (req: Request) => boolean) => {
	const requests: Request[] = []
	page.on('request', (req) => {
		if (matches(req)) {
			requests.push(req)
		}
	})
	return requests
}

const listEn = async (api: APIRequestContext, projectId: string) => {
	const [sk, en] = await listLanguages(api, projectId)
	return listTranslations(api, projectId, sk!.id, en!.id)
}

const itemOf = async (api: APIRequestContext, projectId: string, key: string) => (await listEn(api, projectId)).items.find(({ name }) => name === key)!

test.describe('locked tokens', () => {
	test('a {{var}} is a chip: typing lands around it, the caret skips it, Backspace right after it removes it whole and Esc restores', async ({
		page,
		request,
	}) => {
		const project = await seedProject(request, 'tokens-chip')
		await openTranslationsEn(page, project)
		const puts = trackRequests(page, isTranslationPut)
		const key = 'dashboard.welcome'
		const row = getTranslationRow(page, key)

		const editor = await openEditor(page, key)
		await expect(editor).toHaveAttribute('contenteditable', 'plaintext-only')
		await expect(editor).toHaveText('Welcome back, {{ name }}')
		await expectChips(editor, ['{{ name }}'])
		await expect(getChips(editor).first()).toHaveAttribute('contenteditable', 'false')

		await page.keyboard.type('!')
		await expect(editor).toHaveText('Welcome back, {{ name }}!')
		await expectChips(editor, ['{{ name }}'])
		const saved = waitForTranslationPut(page)
		await page.keyboard.press(SAVE)
		const response = await saved
		expect(response.status()).toBe(200)
		expect(response.request().postDataJSON()).toEqual({ value: 'Welcome back, {{ name }}!' })
		await expect(editor).toHaveCount(0)
		await expect(getCellButton(row, key)).toHaveText(`Preklad kľúča ${key}, English: Welcome back, {{ name }}!`)
		await expect(row.locator('code')).toHaveText(['{{name}}', '{{ name }}'])

		const reopened = await openEditor(page, key)
		await expect(reopened).toHaveText('Welcome back, {{ name }}!')
		// The editor opens with the caret at the end (Home/End only scroll on macOS). Two ArrowLeft cross "!" and the whole chip, one ArrowRight crosses it back.
		await page.keyboard.press('ArrowLeft')
		await page.keyboard.press('ArrowLeft')
		await page.keyboard.type('X')
		await expect(reopened).toHaveText('Welcome back, X{{ name }}!')
		await page.keyboard.press('ArrowRight')
		await page.keyboard.type('Y')
		await expect(reopened).toHaveText('Welcome back, X{{ name }}Y!')
		expect(await editorValue(reopened)).toBe('Welcome back, X{{ name }}Y!')

		await page.keyboard.press('Backspace')
		await expect(reopened).toHaveText('Welcome back, X{{ name }}!')
		await page.keyboard.press('Backspace')
		await expect(reopened).toHaveText('Welcome back, X!')
		await expect(getChips(reopened)).toHaveCount(0)
		expect(await editorValue(reopened)).toBe('Welcome back, X!')

		await page.keyboard.press('Escape')
		await expect(reopened).toHaveCount(0)
		await expect(getCellButton(row, key)).toHaveText(`Preklad kľúča ${key}, English: Welcome back, {{ name }}!`)
		await expect(row.locator('code')).toHaveText(['{{name}}', '{{ name }}'])
		expect(puts).toHaveLength(1)
		expect((await itemOf(request, project.id, key)).target.value).toBe('Welcome back, {{ name }}!')
	})

	test('paste inserts plain text with tags and variables as chips, the exact string is saved and tag chips delete whole', async ({ page, request }) => {
		const project = await seedProject(request, 'tokens-paste')
		// The sample base text of promo.banner has no variables, so `{{x}}` would otherwise be rejected as PLACEHOLDER_MISMATCH.
		await setProtectVariables(request, project.id, false)
		await openTranslationsEn(page, project)
		const key = 'promo.banner'
		const row = getTranslationRow(page, key)

		const editor = await openEditor(page, key)
		await expect(editor).toHaveText('')
		await pasteInto(editor, '<strong>Hi</strong> {{x}}')
		await expectChips(editor, ['<strong>', '</strong>', '{{x}}'])
		expect(await editorValue(editor)).toBe('<strong>Hi</strong> {{x}}')
		await expect(editor.locator('b')).toHaveCount(0)
		const saved = waitForTranslationPut(page)
		await page.keyboard.press(SAVE)
		const response = await saved
		expect(response.status()).toBe(200)
		expect(response.request().postDataJSON()).toEqual({ value: '<strong>Hi</strong> {{x}}' })
		expect(await response.json()).toMatchObject({ value: '<strong>Hi</strong> {{x}}', status: 'TRANSLATED' })
		await expect(editor).toHaveCount(0)
		await expect(getCellButton(row, key)).toHaveText(`Preklad kľúča ${key}, English: <strong>Hi</strong> {{x}}`)
		await expect(row.locator('code')).toHaveText(['{{x}}'])

		const reopened = await openEditor(page, key)
		await expectChips(reopened, ['<strong>', '</strong>', '{{x}}'])
		await page.keyboard.press('Backspace')
		await expectChips(reopened, ['<strong>', '</strong>'])
		expect(await editorValue(reopened)).toBe('<strong>Hi</strong> ')
		await page.keyboard.press('Backspace')
		await page.keyboard.press('Backspace')
		await expectChips(reopened, ['<strong>'])
		expect(await editorValue(reopened)).toBe('<strong>Hi')
		await page.keyboard.type(' there')
		const blurred = waitForTranslationPut(page)
		await page.getByRole('heading', { level: 1, name: 'Preklady' }).click()
		expect((await blurred).request().postDataJSON()).toEqual({ value: '<strong>Hi there' })
		await expect(reopened).toHaveCount(0)
		await expect(row.getByText('<strong>Hi there', { exact: true })).toBeVisible()
	})
})

test.describe('Edit key modal', () => {
	test('ADMIN renames a key (PATCH { name } only), a taken name is a field error, a description shows under the key', async ({
		page,
		request,
		browserName,
	}) => {
		const project = await seedProject(request, 'edit-key')
		await openTranslationsEn(page, project)
		const patches = trackRequests(page, isTranslationKeyPatch)
		await expect(getGroupHeaders(page).filter({ hasText: /^loc:nav$/ })).toHaveCount(1)

		const dialog = await openEditKeyModal(page, 'nav.home')
		const name = dialog.getByRole('textbox', { name: 'Kľúč', exact: true })
		await expect(name).toHaveValue('nav.home')
		await expect(name).toBeFocused()
		await expect(dialog.getByLabel('Popis', { exact: true })).toHaveValue('')
		await expect(dialog.getByRole('checkbox', { name: 'Použiť plurálové formy' })).not.toBeChecked()
		await expect(dialog.getByLabel('Názov premennej', { exact: true })).toHaveCount(0)

		await name.fill('menu.start')
		const renamed = await submitEditKey(page)
		expect(renamed.status()).toBe(200)
		expect(renamed.request().postDataJSON()).toEqual({ name: 'menu.start' })
		expect(await renamed.json()).toEqual({
			keyId: expect.any(String),
			namespace: 'loc',
			name: 'menu.start',
			group: 'loc:menu',
			description: null,
			plural: null,
		})
		await expect(dialog).toHaveCount(0)
		await expect(page.getByText('Kľúč menu.start bol uložený.')).toBeVisible()
		await expect(getTranslationRow(page, 'menu.start')).toHaveCount(1)
		await expect(getTranslationRow(page, 'nav.home')).toHaveCount(0)
		await expect(getTranslationRow(page, 'menu.start')).toContainText('loc:menu')
		await expect(getGroupHeaders(page).filter({ hasText: /^loc:menu$/ })).toHaveCount(1)
		await expect(getGroupHeaders(page).filter({ hasText: /^loc:nav$/ })).toHaveCount(0)
		if (browserName !== 'webkit') {
			// WebKit does not focus a button on mouse click, so the modal has no trigger to return the focus to.
			await expect(getEditKeyButton(getTranslationRow(page, 'menu.start'), 'menu.start')).toBeFocused()
		}

		const taken = await openEditKeyModal(page, 'menu.start')
		await taken.getByRole('textbox', { name: 'Kľúč', exact: true }).fill('orders.empty.title')
		const rejected = await submitEditKey(page)
		expect(rejected.status()).toBe(409)
		expect((await readApiError(rejected)).code).toBe('TRANSLATION_KEY_TAKEN')
		await expect(taken).toBeVisible()
		await expect(taken.getByText('Kľúč s týmto názvom už v namespace existuje.')).toBeVisible()
		await expect(taken.getByRole('textbox', { name: 'Kľúč', exact: true })).toHaveAttribute('aria-invalid', 'true')
		await expect(taken.getByRole('textbox', { name: 'Kľúč', exact: true })).toBeFocused()
		await expect(getTranslationRow(page, 'orders.empty.title')).toHaveCount(1)
		await expect(getTranslationRow(page, 'menu.start')).toHaveCount(1)

		await taken.getByRole('textbox', { name: 'Kľúč', exact: true }).fill('menu.start')
		await taken.getByLabel('Popis', { exact: true }).fill('  Odkaz v hlavnom menu  ')
		const described = await submitEditKey(page)
		expect(described.status()).toBe(200)
		expect(described.request().postDataJSON()).toEqual({ description: 'Odkaz v hlavnom menu' })
		await expect(taken).toHaveCount(0)
		await expect(getTranslationRow(page, 'menu.start').getByText('Odkaz v hlavnom menu', { exact: true })).toBeVisible()
		expect(await itemOf(request, project.id, 'menu.start')).toMatchObject({ description: 'Odkaz v hlavnom menu', plural: null, group: 'loc:menu' })

		const unchanged = await openEditKeyModal(page, 'menu.start')
		await expect(unchanged.getByLabel('Popis', { exact: true })).toHaveValue('Odkaz v hlavnom menu')
		await unchanged.getByRole('button', { name: 'Zrušiť' }).click()
		await expect(unchanged).toHaveCount(0)
		expect(patches).toHaveLength(3)

		await page.reload()
		await expect(getTranslationsTable(page)).toHaveAttribute('aria-busy', 'false')
		await expect(getTranslationRow(page, 'menu.start').getByText('Odkaz v hlavnom menu', { exact: true })).toBeVisible()
	})

	test.describe('as an EDITOR', () => {
		test.use({ storageState: STORAGE_STATE.EDITOR })

		test('a member sees no Upraviť kľúč button and PATCH returns 403 FORBIDDEN', async ({ page, request }) => {
			const project = await seedProject(request, 'edit-key-member')
			await openTranslationsEn(page, project)
			await expect(getTranslationRows(page)).toHaveCount(10)
			await expect(page.getByRole('button', { name: /^Upraviť kľúč / })).toHaveCount(0)

			const item = await itemOf(request, project.id, 'nav.home')
			const response = await request.patch(translationKeyApi(project.id, item.keyId), { data: { name: 'nav.start' }, headers: MUTATION_HEADERS })
			expect(response.status()).toBe(403)
			expect((await readApiError(response)).code).toBe('FORBIDDEN')
			expect((await itemOf(request, project.id, 'nav.home')).name).toBe('nav.home')
		})
	})
})

test.describe('plural forms', () => {
	test('enabling plural stacks the forms, the forms save as one ICU message, disabling keeps Other and renaming the variable re-serializes', async ({
		page,
		request,
	}) => {
		const project = await seedProject(request, 'plural')
		// Forms with `#` have no `{{count}}`, which the base language still has; the check is not the subject here.
		await setProtectVariables(request, project.id, false)
		await openTranslationsEn(page, project)
		const key = 'cart.items'
		const row = getTranslationRow(page, key)
		const cells = row.getByRole('cell')
		const formChips = (cell: Locator) => cell.locator('span[title]').filter({ hasText: /^(Zero|One|Two|Few|Many|Other)$/ })

		const enable = await openEditKeyModal(page, key)
		await enable.getByRole('checkbox', { name: 'Použiť plurálové formy' }).check()
		await expect(enable.getByLabel('Názov premennej', { exact: true })).toHaveValue('count')
		const enabled = await submitEditKey(page)
		expect(enabled.status()).toBe(200)
		expect(enabled.request().postDataJSON()).toEqual({ plural: { variable: 'count' } })
		expect(await enabled.json()).toMatchObject({ name: key, plural: { variable: 'count' } })
		await expect(enable).toHaveCount(0)

		await expect(formChips(cells.nth(1))).toHaveText(['One', 'Few', 'Many', 'Other'])
		await expect(formChips(cells.nth(1)).first()).toHaveAttribute('title', 'Jeden')
		await expect(cells.nth(1).getByText('Bez prekladu', { exact: true })).toHaveCount(3)
		await expect(cells.nth(1)).toContainText('Máte {{count}} položiek')
		await expect(formChips(cells.nth(2))).toHaveText(['One', 'Other'])
		await expect(cells.nth(2).getByText('Bez prekladu', { exact: true })).toHaveCount(1)
		await expect(cells.nth(2)).toContainText('You have {{count}} items')
		expect(await itemOf(request, project.id, key)).toMatchObject({
			plural: { variable: 'count' },
			source: { value: '{count, plural, other {Máte {{count}} položiek}}' },
			target: { value: '{count, plural, other {You have {{count}} items}}', status: 'TRANSLATED' },
		})

		const one = await openEditor(page, key, 'English', 'Jeden')
		const other = getEditor(page, key, 'English', 'Iné')
		await expect(one).toHaveText('')
		await expect(other).toHaveText('You have {{count}} items')
		await expectChips(other, ['{{count}}'])
		await one.fill('You have # item')
		await expectChips(one, ['#'])
		await other.fill('You have # items')
		await expectChips(other, ['#'])
		await expect(one).toHaveCount(1)
		const saved = waitForTranslationPut(page)
		await page.keyboard.press(SAVE)
		const response = await saved
		expect(response.status()).toBe(200)
		expect(response.request().postDataJSON()).toEqual({ value: '{count, plural, one {You have # item} other {You have # items}}' })
		await expect(one).toHaveCount(0)
		await expect(formChips(cells.nth(2))).toHaveText(['One', 'Other'])
		await expect(cells.nth(2).locator('code')).toHaveText(['#', '#'])
		await expect(cells.nth(2)).toContainText('You have # item')
		await expect(cells.nth(2)).toContainText('You have # items')
		expect(await itemOf(request, project.id, key)).toMatchObject({
			plural: { variable: 'count' },
			target: { value: '{count, plural, one {You have # item} other {You have # items}}' },
		})

		const disable = await openEditKeyModal(page, key)
		await disable.getByRole('checkbox', { name: 'Použiť plurálové formy' }).uncheck()
		await expect(disable.getByLabel('Názov premennej', { exact: true })).toHaveCount(0)
		const disabled = await submitEditKey(page)
		expect(disabled.status()).toBe(200)
		expect(disabled.request().postDataJSON()).toEqual({ plural: null })
		await expect(disable).toHaveCount(0)
		await expect(formChips(cells.nth(2))).toHaveCount(0)
		await expect(getCellButton(row, key)).toHaveText(`Preklad kľúča ${key}, English: You have # items`)
		await expect(cells.nth(1)).toHaveText('Máte {{count}} položiek')
		expect(await itemOf(request, project.id, key)).toMatchObject({
			plural: null,
			source: { value: 'Máte {{count}} položiek' },
			target: { value: 'You have # items' },
		})

		const rename = await openEditKeyModal(page, key)
		await rename.getByRole('checkbox', { name: 'Použiť plurálové formy' }).check()
		await rename.getByLabel('Názov premennej', { exact: true }).fill('n')
		const renamed = await submitEditKey(page)
		expect(renamed.status()).toBe(200)
		expect(renamed.request().postDataJSON()).toEqual({ plural: { variable: 'n' } })
		await expect(rename).toHaveCount(0)
		expect(await itemOf(request, project.id, key)).toMatchObject({
			plural: { variable: 'n' },
			target: { value: '{n, plural, other {You have # items}}' },
		})

		const variable = await openEditKeyModal(page, key)
		await expect(variable.getByLabel('Názov premennej', { exact: true })).toHaveValue('n')
		await variable.getByLabel('Názov premennej', { exact: true }).fill('num')
		const reserialized = await submitEditKey(page)
		expect(reserialized.request().postDataJSON()).toEqual({ plural: { variable: 'num' } })
		await expect(variable).toHaveCount(0)
		await expect(formChips(cells.nth(2))).toHaveText(['One', 'Other'])
		expect(await itemOf(request, project.id, key)).toMatchObject({
			plural: { variable: 'num' },
			source: { value: '{num, plural, other {Máte {{count}} položiek}}' },
			target: { value: '{num, plural, other {You have # items}}' },
		})
	})

	test('an invalid variable name is a field error without a request', async ({ page, request }) => {
		const project = await seedProject(request, 'plural-invalid')
		await openTranslationsEn(page, project)
		const patches = trackRequests(page, isTranslationKeyPatch)

		const dialog = await openEditKeyModal(page, 'cart.items')
		await dialog.getByRole('checkbox', { name: 'Použiť plurálové formy' }).check()
		await dialog.getByLabel('Názov premennej', { exact: true }).fill('1count')
		await dialog.getByRole('button', { name: 'Uložiť' }).click()
		await expect(dialog.getByLabel('Názov premennej', { exact: true })).toHaveAttribute('aria-invalid', 'true')
		await expect(dialog).toBeVisible()
		expect(patches).toEqual([])
		expect((await itemOf(request, project.id, 'cart.items')).plural).toBeNull()
	})
})
