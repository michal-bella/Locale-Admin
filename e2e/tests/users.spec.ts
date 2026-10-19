import { expect, type Page, test } from '@playwright/test'

import { ANONYMOUS, expectLoggedInHome, loginViaUi } from '../support/auth'
import { ADMIN_EMAIL } from '../support/env'
import { createAdmin, createEditor, createMember, newTestUserCredentials } from '../support/users'

const openUsersPage = async (page: Page) => {
	await page.goto('/admin/users')
	const table = page.getByRole('table', { name: 'Zoznam používateľov' })
	await expect(table).toHaveAttribute('aria-busy', 'false')
	return table
}

const openCreateModal = async (page: Page) => {
	await page.getByRole('button', { name: 'Vytvoriť používateľa' }).click()
	const dialog = page.getByRole('dialog', { name: 'Nový používateľ' })
	await expect(dialog).toBeVisible()
	return dialog
}

const formatCreatedAt = (createdAt: string, locale: 'sk-SK' | 'en-GB') =>
	new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'numeric', year: 'numeric' }).format(new Date(createdAt))

test('ADMIN creates an admin who can then log in and sees Používatelia', async ({ page, browser, baseURL }) => {
	const table = await openUsersPage(page)
	await page.evaluate(() => Object.assign(window, { e2eNoReload: true }))
	const credentials = newTestUserCredentials()

	const dialog = await openCreateModal(page)
	await dialog.getByLabel('E-mail', { exact: true }).fill(credentials.email)
	await dialog.getByLabel('Heslo', { exact: true }).fill(credentials.password)
	await expect(dialog.getByRole('radio', { name: 'Člen' })).toBeChecked()
	// The SegmentedControl radio is visually hidden, so the label is clicked instead of check().
	await dialog.getByText('Administrátor', { exact: true }).click()
	await expect(dialog.getByRole('radio', { name: 'Administrátor' })).toBeChecked()
	const createResponse = page.waitForResponse((response) => response.url().endsWith('/api/admin/users') && response.request().method() === 'POST')
	await dialog.getByRole('button', { name: 'Vytvoriť používateľa' }).click()
	expect((await createResponse).status()).toBe(201)

	await expect(page.getByText(`Používateľ ${credentials.email} bol vytvorený.`)).toBeVisible()
	await expect(dialog).toBeHidden()
	const row = table.getByRole('row').filter({ hasText: credentials.email })
	await expect(row).toBeVisible()
	await expect(row.getByRole('cell').nth(1)).toHaveText('Administrátor')
	await expect(row.getByRole('cell').nth(2)).toHaveText('0')
	expect(await page.evaluate(() => 'e2eNoReload' in window)).toBe(true)

	const context = await browser.newContext({ baseURL, storageState: ANONYMOUS })
	const newUserPage = await context.newPage()
	await loginViaUi(newUserPage, credentials)
	await expectLoggedInHome(newUserPage)
	await newUserPage.goto('/admin/users')
	await expect(newUserPage.getByRole('table', { name: 'Zoznam používateľov' }).getByRole('row').filter({ hasText: credentials.email })).toBeVisible()
	await context.close()
})

test('shows client-side field errors without calling the API', async ({ page }) => {
	await openUsersPage(page)
	const posts: string[] = []
	page.on('request', (request) => {
		if (request.method() === 'POST' && request.url().endsWith('/api/admin/users')) {
			posts.push(request.url())
		}
	})

	const dialog = await openCreateModal(page)
	const email = dialog.getByLabel('E-mail', { exact: true })
	const password = dialog.getByLabel('Heslo', { exact: true })
	await email.fill('not-an-email')
	await password.fill('short')
	await dialog.getByRole('button', { name: 'Vytvoriť používateľa' }).click()

	await expect(email).toHaveAttribute('aria-invalid', 'true')
	await expect(email).toHaveAccessibleDescription('Zadajte platný e-mail.')
	await expect(password).toHaveAttribute('aria-invalid', 'true')
	await expect(password).toHaveAccessibleDescription('Zadajte aspoň 8 znakov.')
	await expect(dialog).toBeVisible()
	expect(posts).toEqual([])

	await dialog.getByRole('button', { name: 'Zrušiť' }).click()
	await expect(dialog).toBeHidden()
})

test('existing email in a different letter case shows 409 at the E-mail field', async ({ page, playwright, baseURL }) => {
	const existing = await createEditor(playwright.request, baseURL)
	await openUsersPage(page)

	const dialog = await openCreateModal(page)
	const email = dialog.getByLabel('E-mail', { exact: true })
	await email.fill(existing.email.toUpperCase())
	await dialog.getByLabel('Heslo', { exact: true }).fill(newTestUserCredentials().password)
	const createResponse = page.waitForResponse((response) => response.url().endsWith('/api/admin/users') && response.request().method() === 'POST')
	await dialog.getByRole('button', { name: 'Vytvoriť používateľa' }).click()
	expect((await createResponse).status()).toBe(409)

	await expect(email).toHaveAttribute('aria-invalid', 'true')
	await expect(email).toHaveAccessibleDescription('Používateľ s týmto e-mailom už existuje.')
	await expect(dialog).toBeVisible()
})

test('ADMIN creates a member who logs in and has no Používatelia', async ({ page, browser, baseURL }) => {
	const table = await openUsersPage(page)
	const credentials = newTestUserCredentials()

	const dialog = await openCreateModal(page)
	await dialog.getByLabel('E-mail', { exact: true }).fill(credentials.email)
	await dialog.getByLabel('Heslo', { exact: true }).fill(credentials.password)
	const createResponse = page.waitForResponse((response) => response.url().endsWith('/api/admin/users') && response.request().method() === 'POST')
	await dialog.getByRole('button', { name: 'Vytvoriť používateľa' }).click()
	expect((await createResponse).status()).toBe(201)
	await expect(table.getByRole('row').filter({ hasText: credentials.email }).getByRole('cell').nth(1)).toHaveText('Člen')

	const context = await browser.newContext({ baseURL, storageState: ANONYMOUS })
	const memberPage = await context.newPage()
	await loginViaUi(memberPage, credentials)
	await expectLoggedInHome(memberPage)
	await expect(memberPage.getByText('Zatiaľ nemáte žiadny projekt. Vytvorte prvý.')).toBeVisible()
	await expect(memberPage.getByRole('link', { name: 'Používatelia' })).toHaveCount(0)
	await context.close()
})

test('lists members with their role and project count', async ({ page, playwright, baseURL }) => {
	const editor = await createEditor(playwright.request, baseURL)
	const member = await createMember(playwright.request, baseURL)
	const admin = await createAdmin(playwright.request, baseURL)
	const table = await openUsersPage(page)

	const cellsOf = (email: string) => table.getByRole('row').filter({ hasText: email }).getByRole('cell')
	await expect(cellsOf(editor.email).nth(1)).toHaveText('Člen')
	await expect(cellsOf(editor.email).nth(2)).toHaveText('1')
	await expect(cellsOf(member.email).nth(2)).toHaveText('0')
	await expect(cellsOf(admin.email).nth(1)).toHaveText('Administrátor')
})

test('created date follows the UI language (SK and EN)', async ({ page, playwright, baseURL }) => {
	const user = await createAdmin(playwright.request, baseURL)
	await openUsersPage(page)
	const createdCell = page.getByRole('row').filter({ hasText: user.email }).getByRole('cell').nth(3)

	await expect(createdCell).toHaveText(/^\d{1,2}\.\s\d{1,2}\.\s\d{4}$/)
	await expect(createdCell).toHaveText(formatCreatedAt(user.createdAt, 'sk-SK'))

	await page.getByRole('combobox', { name: 'Jazyk', exact: true }).click()
	await page.getByRole('option', { name: 'English', exact: true }).click()
	await expect(page.getByRole('table', { name: 'User list' })).toBeVisible()
	await expect(createdCell).toHaveText(/^\d{2}\/\d{2}\/\d{4}$/)
	await expect(createdCell).toHaveText(formatCreatedAt(user.createdAt, 'en-GB'))
})

test('ADMIN deletes a member of one project, who can no longer log in; the own row has no delete', async ({ page, browser, playwright, baseURL }) => {
	const editor = await createEditor(playwright.request, baseURL)
	const table = await openUsersPage(page)

	await expect(page.getByRole('button', { name: `Odstrániť používateľa ${ADMIN_EMAIL}` })).toHaveCount(0)
	await page.getByRole('button', { name: `Odstrániť používateľa ${editor.email}` }).click()
	const dialog = page.getByRole('dialog', { name: 'Odstrániť používateľa' })
	await expect(dialog).toContainText(`Naozaj chcete odstrániť účet ${editor.email}? Odoberie sa z 1 projektu`)
	const deleted = page.waitForResponse((response) => response.url().endsWith(`/api/admin/users/${editor.id}`) && response.request().method() === 'DELETE')
	await dialog.getByRole('button', { name: 'Odstrániť' }).click()
	expect((await deleted).status()).toBe(204)

	await expect(page.getByText(`Používateľ ${editor.email} bol odstránený.`)).toBeVisible()
	await expect(table.getByRole('row').filter({ hasText: editor.email })).toHaveCount(0)

	await page.goto(`/projects/${editor.projectSlug}/members`)
	const members = page.getByRole('table', { name: 'Zoznam členov' })
	await expect(members).toHaveAttribute('aria-busy', 'false')
	await expect(members.getByRole('row').filter({ hasText: editor.email })).toHaveCount(0)

	const context = await browser.newContext({ baseURL, storageState: ANONYMOUS })
	const deletedPage = await context.newPage()
	await loginViaUi(deletedPage, editor)
	await expect(deletedPage.getByText('Nesprávny e-mail alebo heslo.')).toBeVisible()
	await context.close()
})
