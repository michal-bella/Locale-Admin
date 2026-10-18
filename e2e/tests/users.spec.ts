import { expect, type Page, test } from '@playwright/test'

import { ANONYMOUS, expectLoggedInHome, loginViaUi } from '../support/auth'
import { createAdmin, createEditor, newTestUserCredentials } from '../support/users'

const openUsersPage = async (page: Page) => {
	await page.goto('/admin/users')
	const table = page.getByRole('table', { name: 'Zoznam administrátorov' })
	await expect(table).toHaveAttribute('aria-busy', 'false')
	return table
}

const openCreateModal = async (page: Page) => {
	await page.getByRole('button', { name: 'Vytvoriť administrátora' }).click()
	const dialog = page.getByRole('dialog', { name: 'Nový administrátor' })
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
	const createResponse = page.waitForResponse((response) => response.url().endsWith('/api/admin/users') && response.request().method() === 'POST')
	await dialog.getByRole('button', { name: 'Vytvoriť administrátora' }).click()
	expect((await createResponse).status()).toBe(201)

	await expect(page.getByText(`Administrátor ${credentials.email} bol vytvorený.`)).toBeVisible()
	await expect(dialog).toBeHidden()
	await expect(table.getByRole('row').filter({ hasText: credentials.email })).toBeVisible()
	expect(await page.evaluate(() => 'e2eNoReload' in window)).toBe(true)

	const context = await browser.newContext({ baseURL, storageState: ANONYMOUS })
	const newUserPage = await context.newPage()
	await loginViaUi(newUserPage, credentials)
	await expectLoggedInHome(newUserPage)
	await newUserPage.goto('/admin/users')
	await expect(newUserPage.getByRole('table', { name: 'Zoznam administrátorov' }).getByRole('row').filter({ hasText: credentials.email })).toBeVisible()
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
	await dialog.getByRole('button', { name: 'Vytvoriť administrátora' }).click()

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
	await dialog.getByRole('button', { name: 'Vytvoriť administrátora' }).click()
	expect((await createResponse).status()).toBe(409)

	await expect(email).toHaveAttribute('aria-invalid', 'true')
	await expect(email).toHaveAccessibleDescription('Používateľ s týmto e-mailom už existuje.')
	await expect(dialog).toBeVisible()
})

test('lists admins only, not project members', async ({ page, playwright, baseURL }) => {
	const member = await createEditor(playwright.request, baseURL)
	const admin = await createAdmin(playwright.request, baseURL)
	const table = await openUsersPage(page)

	await expect(table.getByRole('row').filter({ hasText: admin.email })).toBeVisible()
	await expect(table.getByRole('row').filter({ hasText: member.email })).toHaveCount(0)
})

test('created date follows the UI language (SK and EN)', async ({ page, playwright, baseURL }) => {
	const user = await createAdmin(playwright.request, baseURL)
	await openUsersPage(page)
	const createdCell = page.getByRole('row').filter({ hasText: user.email }).getByRole('cell').nth(1)

	await expect(createdCell).toHaveText(/^\d{1,2}\.\s\d{1,2}\.\s\d{4}$/)
	await expect(createdCell).toHaveText(formatCreatedAt(user.createdAt, 'sk-SK'))

	// WebKit does not reliably click the visually hidden radio input; click its visible label text instead.
	await page.getByRole('radiogroup', { name: 'Jazyk' }).getByText('EN', { exact: true }).click()
	await expect(page.getByRole('table', { name: 'Administrator list' })).toBeVisible()
	await expect(createdCell).toHaveText(/^\d{2}\/\d{2}\/\d{4}$/)
	await expect(createdCell).toHaveText(formatCreatedAt(user.createdAt, 'en-GB'))
})
