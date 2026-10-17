import { type APIRequestContext, expect, type Page, test } from '@playwright/test'

import { readApiError } from '../support/api'
import { ANONYMOUS, STORAGE_STATE } from '../support/auth'
import {
	acquireLanguagesLock,
	deleteLanguageIfPresent,
	deleteLeftoverTestLanguages,
	type Language,
	LANGUAGES_API,
	listLanguages,
	newAdminApi,
	restoreBaseLanguage,
	TEST_LANGUAGE,
} from '../support/languages'
import { getMainNavigation, openUserMenu } from '../support/layout'

const PAGE_HEADING = { level: 1, name: 'Jazyky' } as const
const EDITED_FLAG = { code: 'bg', label: /\(BG\)$/ } as const

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const getTable = (page: Page) => page.getByRole('table', { name: 'Zoznam jazykov' })

// The second line of a row is "{nativeName} · {tag}"; the tag never changes, so rows are found by it.
const getRow = (page: Page, tag: string) =>
	getTable(page)
		.getByRole('row')
		.filter({ has: page.getByText(new RegExp(`· ${escapeRegExp(tag)}$`)) })

const getBaseBadge = (page: Page, tag: string) => getRow(page, tag).getByText('Základný', { exact: true })

const openLanguagesPage = async (page: Page) => {
	await page.goto('/languages')
	await expect(page.getByRole('heading', PAGE_HEADING)).toBeVisible()
	await expect(getTable(page)).toHaveAttribute('aria-busy', 'false')
}

const openRowMenu = async (page: Page, englishName: string) => {
	await page.getByRole('button', { name: `Akcie pre jazyk ${englishName}`, exact: true }).click()
	await expect(page.getByRole('menuitem', { name: 'Upraviť' })).toBeVisible()
}

const openSettings = async (page: Page, englishName: string) => {
	await openRowMenu(page, englishName)
	await page.getByRole('menuitem', { name: 'Upraviť' }).click()
	const dialog = page.getByRole('dialog', { name: 'Nastavenia jazyka' })
	await expect(dialog).toBeVisible()
	return dialog
}

// Mantine marks a disabled option only with `data-combobox-disabled` (no `aria-disabled`), so toBeDisabled() cannot see it.
const expectOptionDisabled = async (page: Page, name: string) => {
	await expect(page.getByRole('option', { name })).toHaveAttribute('data-combobox-disabled', 'true')
}

const openAddModal = async (page: Page) => {
	await page.getByRole('button', { name: 'Pridať jazyk', exact: true }).click()
	const dialog = page.getByRole('dialog', { name: 'Pridať jazyk' })
	await expect(dialog).toBeVisible()
	const select = dialog.getByLabel('Jazyk')
	await select.click()
	return { dialog, select }
}

const waitForLanguagesResponse = (page: Page, method: string) =>
	page.waitForResponse((response) => response.url().includes(LANGUAGES_API) && response.request().method() === method)

test.describe('ADMIN', () => {
	// The catalog and the base flag are shared: tests in a project depend on each other and the lock keeps the other project out.
	test.describe.configure({ mode: 'serial' })

	let api: APIRequestContext
	let releaseLock: (() => Promise<void>) | undefined
	let base: Language
	let testLanguage: (typeof TEST_LANGUAGE)[keyof typeof TEST_LANGUAGE]
	let editedName: string

	test.beforeAll(async ({ playwright }, testInfo) => {
		// Waiting for the other browser project to release the lock counts against this hook.
		test.setTimeout(180_000)
		const projectName = testInfo.project.name
		expect(projectName === 'chromium' || projectName === 'webkit', `a test language for project ${projectName}`).toBe(true)
		testLanguage = TEST_LANGUAGE[projectName as 'chromium' | 'webkit']
		editedName = `${testLanguage.englishName} E2E`

		releaseLock = await acquireLanguagesLock()
		api = await newAdminApi(playwright.request)
		await deleteLeftoverTestLanguages(api)
		const current = (await listLanguages(api)).find(({ isBase }) => isBase)
		expect(current, 'a base language in the DB (seed adds sk as base into an empty table)').toBeDefined()
		base = current!
	})

	test.afterAll(async () => {
		try {
			if (api) {
				if (base) {
					await restoreBaseLanguage(api, base)
				}
				await deleteLanguageIfPresent(api, testLanguage.tag, base?.tag)
				await api.dispose()
			}
		} finally {
			await releaseLock?.()
		}
	})

	test('opens Jazyky from the sidebar and sees sk, en and the current base language with the badge', async ({ page }) => {
		await page.goto('/')
		const item = getMainNavigation(page).getByRole('link', { name: 'Jazyky' })
		await expect(item).toHaveAttribute('href', '/languages')
		await item.click()
		await expect(page).toHaveURL('/languages')
		await expect(page.getByRole('heading', PAGE_HEADING)).toBeVisible()
		await expect(getTable(page)).toHaveAttribute('aria-busy', 'false')

		await expect(getRow(page, 'sk')).toContainText('Slovak')
		await expect(getRow(page, 'en')).toContainText('English')
		// The DB is shared with dev mode, so the base language is whatever beforeAll found (sk after a fresh seed).
		await expect(getBaseBadge(page, base.tag)).toBeVisible()
		await expect(getTable(page).getByText('Základný', { exact: true })).toHaveCount(1)
		await expect(getRow(page, testLanguage.tag)).toHaveCount(0)
	})

	test('adds a language: the row appears and the language is disabled in the add select', async ({ page }) => {
		await openLanguagesPage(page)
		const optionName = `${testLanguage.englishName} – ${testLanguage.nativeName} – ${testLanguage.tag}`

		const { dialog, select } = await openAddModal(page)
		await expectOptionDisabled(page, 'Slovak – slovenčina – sk')
		await select.fill(testLanguage.englishName)
		await page.getByRole('option', { name: optionName }).click()
		await expect(select).toHaveValue(optionName)
		const created = waitForLanguagesResponse(page, 'POST')
		await dialog.getByRole('button', { name: 'Pridať', exact: true }).click()
		expect((await created).status()).toBe(201)

		await expect(page.getByText(`Jazyk ${testLanguage.englishName} bol pridaný.`)).toBeVisible()
		await expect(dialog).toBeHidden()
		const row = getRow(page, testLanguage.tag)
		await expect(row).toContainText(testLanguage.englishName)
		await expect(row).toContainText(`${testLanguage.nativeName} · ${testLanguage.tag}`)
		await expect(row.locator(`svg[data-flag="${testLanguage.flagCode}"]`)).toBeVisible()
		await expect(getBaseBadge(page, testLanguage.tag)).toHaveCount(0)

		const reopened = await openAddModal(page)
		await expectOptionDisabled(page, optionName)
		await expect(reopened.dialog.getByRole('button', { name: 'Pridať', exact: true })).toBeDisabled()
		// The open dropdown covers the footer; a click outside the select closes it.
		await reopened.dialog.getByText('Vyberte jazyk zo zoznamu podporovaných jazykov.').click()
		await expect(page.getByRole('option', { name: optionName })).toBeHidden()
		await reopened.dialog.getByRole('button', { name: 'Zrušiť' }).click()
		await expect(reopened.dialog).toBeHidden()
	})

	test('edits the English name and the flag, both persist after a reload', async ({ page }) => {
		await openLanguagesPage(page)

		const dialog = await openSettings(page, testLanguage.englishName)
		await expect(dialog.getByLabel('Tag', { exact: true })).toHaveValue(testLanguage.tag)
		await expect(dialog.getByLabel('Tag', { exact: true })).toBeDisabled()
		const save = dialog.getByRole('button', { name: 'Uložiť' })
		await expect(save).toBeDisabled()

		await dialog.getByLabel('Anglický názov', { exact: true }).fill(`  ${editedName} `)
		await dialog.getByLabel('Vlajka').click()
		await page.getByRole('option', { name: EDITED_FLAG.label }).click()
		await expect(dialog.getByLabel('Vlajka')).toHaveValue(EDITED_FLAG.label)
		const patched = waitForLanguagesResponse(page, 'PATCH')
		await save.click()
		expect((await patched).status()).toBe(200)

		await expect(page.getByText(`Jazyk ${editedName} bol uložený.`)).toBeVisible()
		await expect(dialog).toBeHidden()
		const row = getRow(page, testLanguage.tag)
		await expect(row).toContainText(editedName)
		await expect(row.locator(`svg[data-flag="${EDITED_FLAG.code}"]`)).toBeVisible()

		await page.reload()
		await expect(getTable(page)).toHaveAttribute('aria-busy', 'false')
		await expect(row).toContainText(editedName)
		await expect(row.locator(`svg[data-flag="${EDITED_FLAG.code}"]`)).toBeVisible()
		const reopened = await openSettings(page, editedName)
		await expect(reopened.getByLabel('Anglický názov', { exact: true })).toHaveValue(editedName)
		await expect(reopened.getByLabel('Pôvodný názov', { exact: true })).toHaveValue(testLanguage.nativeName)
		await expect(reopened.getByLabel('Vlajka')).toHaveValue(EDITED_FLAG.label)
		await reopened.getByRole('button', { name: 'Zrušiť' }).click()
		await expect(reopened).toBeHidden()
	})

	test('sets the language as base, the badge moves, then the original base is restored', async ({ page }) => {
		await openLanguagesPage(page)

		const dialog = await openSettings(page, editedName)
		const baseSwitch = dialog.getByRole('switch', { name: 'Základný jazyk' })
		await expect(baseSwitch).not.toBeChecked()
		await expect(baseSwitch).toBeEnabled()
		await baseSwitch.click()
		await expect(baseSwitch).toBeChecked()
		const patched = waitForLanguagesResponse(page, 'PATCH')
		await dialog.getByRole('button', { name: 'Uložiť' }).click()
		expect((await patched).status()).toBe(200)
		await expect(dialog).toBeHidden()

		await expect(getBaseBadge(page, testLanguage.tag)).toBeVisible()
		await expect(getBaseBadge(page, base.tag)).toHaveCount(0)
		await expect(getTable(page).getByText('Základný', { exact: true })).toHaveCount(1)
		await expect(getTable(page).getByRole('row').nth(1)).toContainText(editedName)

		const restore = await openSettings(page, base.englishName)
		await restore.getByRole('switch', { name: 'Základný jazyk' }).click()
		const restored = waitForLanguagesResponse(page, 'PATCH')
		await restore.getByRole('button', { name: 'Uložiť' }).click()
		expect((await restored).status()).toBe(200)
		await expect(restore).toBeHidden()

		await expect(getBaseBadge(page, base.tag)).toBeVisible()
		await expect(getBaseBadge(page, testLanguage.tag)).toHaveCount(0)
		expect((await listLanguages(page.request)).find(({ isBase }) => isBase)?.id).toBe(base.id)
	})

	test('Odstrániť is disabled for the base language in the menu and in the settings modal', async ({ page }) => {
		await openLanguagesPage(page)

		await openRowMenu(page, base.englishName)
		await expect(page.getByRole('menuitem', { name: 'Odstrániť' })).toBeDisabled()
		await page.keyboard.press('Escape')
		await expect(page.getByRole('menuitem', { name: 'Upraviť' })).toBeHidden()

		const dialog = await openSettings(page, base.englishName)
		await expect(dialog.getByRole('button', { name: 'Odstrániť jazyk' })).toBeDisabled()
		await expect(dialog.getByRole('switch', { name: 'Základný jazyk' })).toBeChecked()
		await expect(dialog.getByRole('switch', { name: 'Základný jazyk' })).toBeDisabled()
		await dialog.getByRole('button', { name: 'Zrušiť' }).click()
		await expect(dialog).toBeHidden()

		await openRowMenu(page, editedName)
		await expect(page.getByRole('menuitem', { name: 'Odstrániť' })).toBeEnabled()
		await page.keyboard.press('Escape')
	})

	test('deletes only after confirmation: Zrušiť keeps the row, Odstrániť removes it', async ({ page }) => {
		await openLanguagesPage(page)
		const row = getRow(page, testLanguage.tag)
		const deletes: string[] = []
		page.on('request', (request) => {
			if (request.method() === 'DELETE' && request.url().includes(LANGUAGES_API)) {
				deletes.push(request.url())
			}
		})

		await openRowMenu(page, editedName)
		await page.getByRole('menuitem', { name: 'Odstrániť' }).click()
		const confirm = page.getByRole('dialog', { name: 'Odstrániť jazyk' })
		await expect(confirm).toContainText(`Naozaj chcete odstrániť jazyk ${editedName} (${testLanguage.tag})?`)
		await confirm.getByRole('button', { name: 'Zrušiť' }).click()
		await expect(confirm).toBeHidden()
		await expect(row).toBeVisible()
		expect(deletes).toEqual([])

		const settings = await openSettings(page, editedName)
		await settings.getByRole('button', { name: 'Odstrániť jazyk' }).click()
		await expect(confirm).toBeVisible()
		const deleted = waitForLanguagesResponse(page, 'DELETE')
		await confirm.getByRole('button', { name: 'Odstrániť', exact: true }).click()
		expect((await deleted).status()).toBe(204)

		await expect(page.getByText(`Jazyk ${editedName} bol odstránený.`)).toBeVisible()
		await expect(confirm).toBeHidden()
		await expect(settings).toBeHidden()
		await expect(row).toHaveCount(0)
		await expect(getBaseBadge(page, base.tag)).toBeVisible()
		expect((await listLanguages(page.request)).map(({ tag }) => tag)).not.toContain(testLanguage.tag)
	})
})

test.describe('EDITOR', () => {
	test.use({ storageState: STORAGE_STATE.EDITOR })

	test('does not see the Jazyky link in the sidebar or the user menu', async ({ page }) => {
		await page.goto('/')
		await expect(getMainNavigation(page)).toBeAttached()
		await expect(page.getByRole('link', { name: 'Jazyky' })).toHaveCount(0)
		const menu = await openUserMenu(page)
		await expect(menu.getByRole('menuitem', { name: 'Odhlásiť sa', exact: true })).toBeVisible()
		await expect(menu.getByRole('menuitem', { name: 'Jazyky' })).toHaveCount(0)
	})

	test('/languages shows the 403 page and the API returns 403', async ({ page }) => {
		await page.goto('/languages')
		await expect(page.getByRole('heading', { level: 1, name: 'Prístup zamietnutý' })).toBeVisible()
		await expect(page).toHaveURL('/languages')
		await expect(page.getByRole('heading', PAGE_HEADING)).toHaveCount(0)
		await expect(getTable(page)).toHaveCount(0)
		await expect(page.getByRole('button', { name: 'Pridať jazyk' })).toHaveCount(0)

		const response = await page.request.get(LANGUAGES_API)
		expect(response.status()).toBe(403)
		expect((await readApiError(response)).code).toBe('FORBIDDEN')
	})
})

test.describe('anonymous', () => {
	test.use({ storageState: ANONYMOUS })

	test('/languages redirects to /login', async ({ page }) => {
		await page.goto('/languages')
		await expect(page).toHaveURL('/login')
		await expect(page.getByRole('heading', { level: 1, name: 'Vitajte späť' })).toBeVisible()
	})
})
