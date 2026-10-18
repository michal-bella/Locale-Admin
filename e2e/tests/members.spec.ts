import { expect, type Page, test } from '@playwright/test'

import { ANONYMOUS, expectLoggedInHome, loginViaUi } from '../support/auth'
import { createEditor, newTestUserCredentials } from '../support/users'

const openMembersPage = async (page: Page, projectId: string) => {
	await page.goto(`/projects/${projectId}/members`)
	const table = page.getByRole('table', { name: 'Zoznam členov' })
	await expect(table).toHaveAttribute('aria-busy', 'false')
	return table
}

const openCreateModal = async (page: Page) => {
	await page.getByRole('button', { name: 'Pridať člena' }).click()
	const dialog = page.getByRole('dialog', { name: 'Nový člen' })
	await expect(dialog).toBeVisible()
	return dialog
}

test.use({ storageState: ANONYMOUS })

test('a member adds a new member, who logs in and sees only this project', async ({ page, browser, playwright, baseURL }) => {
	const editor = await createEditor(playwright.request, baseURL)
	await loginViaUi(page, editor)
	await expectLoggedInHome(page)
	const table = await openMembersPage(page, editor.projectId)
	await expect(table.getByRole('row').filter({ hasText: editor.email })).toBeVisible()

	const credentials = newTestUserCredentials()
	const dialog = await openCreateModal(page)
	await dialog.getByLabel('E-mail', { exact: true }).fill(credentials.email)
	await dialog.getByLabel('Heslo', { exact: true }).fill(credentials.password)
	const created = page.waitForResponse(
		(response) => response.url().endsWith(`/api/projects/${editor.projectId}/members`) && response.request().method() === 'POST',
	)
	await dialog.getByRole('button', { name: 'Pridať člena' }).click()
	expect((await created).status()).toBe(201)

	await expect(page.getByText(`Člen ${credentials.email} bol pridaný do projektu.`)).toBeVisible()
	await expect(dialog).toBeHidden()
	await expect(table.getByRole('row').filter({ hasText: credentials.email })).toBeVisible()

	const context = await browser.newContext({ baseURL, storageState: ANONYMOUS })
	const newMemberPage = await context.newPage()
	await loginViaUi(newMemberPage, credentials)
	await expectLoggedInHome(newMemberPage)
	const list = newMemberPage.getByRole('list', { name: 'Zoznam projektov' })
	await expect(list.getByRole('listitem')).toHaveCount(1)
	await list.getByRole('link').click()
	await expect(newMemberPage).toHaveURL(`/projects/${editor.projectId}/settings`)
	await context.close()
})

test('an existing email shows 409 at the E-mail field', async ({ page, playwright, baseURL }) => {
	const editor = await createEditor(playwright.request, baseURL)
	await loginViaUi(page, editor)
	await expectLoggedInHome(page)
	await openMembersPage(page, editor.projectId)

	const dialog = await openCreateModal(page)
	const email = dialog.getByLabel('E-mail', { exact: true })
	await email.fill(editor.email.toUpperCase())
	await dialog.getByLabel('Heslo', { exact: true }).fill(newTestUserCredentials().password)
	await dialog.getByRole('button', { name: 'Pridať člena' }).click()

	await expect(email).toHaveAttribute('aria-invalid', 'true')
	await expect(email).toHaveAccessibleDescription('Používateľ s týmto e-mailom už existuje.')
	await expect(dialog).toBeVisible()
})
