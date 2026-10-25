import { expect, type Page, test } from '@playwright/test'

import { ANONYMOUS, expectLoggedInHome, loginViaUi } from '../support/auth'
import { ADMIN_EMAIL } from '../support/env'
import { createEditor, createMember, newTestUserCredentials } from '../support/users'

const openMembersPage = async (page: Page, projectSlug: string) => {
	await page.goto(`/projects/${projectSlug}/members`)
	const table = page.getByRole('table', { name: 'Zoznam členov' })
	await expect(table).toHaveAttribute('aria-busy', 'false')
	return table
}

const openAddModal = async (page: Page) => {
	await page.getByRole('button', { name: 'Pridať člena' }).click()
	const dialog = page.getByRole('dialog', { name: 'Pridať člena' })
	await expect(dialog).toBeVisible()
	return dialog
}

const waitForAddResponse = (page: Page, projectId: string) =>
	page.waitForResponse((response) => response.url().endsWith(`/api/projects/${projectId}/members`) && response.request().method() === 'POST')

const expectSeesOnlyProject = async (page: Page, projectSlug: string) => {
	const list = page.getByRole('list', { name: 'Zoznam projektov' })
	// Each row also holds a list of its language flags, so only the direct items are projects.
	await expect(list.locator(':scope > li')).toHaveCount(1)
	await list.getByRole('link', { name: /^Nastavenia projektu / }).click()
	await expect(page).toHaveURL(`/projects/${projectSlug}/settings`)
}

test.describe('ADMIN', () => {
	test('adds an existing user from the select, who logs in and sees only this project', async ({ page, browser, playwright, baseURL }) => {
		const editor = await createEditor(playwright.request, baseURL)
		const member = await createMember(playwright.request, baseURL)
		const table = await openMembersPage(page, editor.projectSlug)
		await expect(table.getByRole('row').filter({ hasText: editor.email })).toBeVisible()

		const dialog = await openAddModal(page)
		const select = dialog.getByLabel('Používateľ')
		await select.fill(member.email)
		await expect(page.getByRole('option', { name: editor.email })).toHaveCount(0)
		await page.getByRole('option', { name: member.email }).click()
		const added = waitForAddResponse(page, editor.projectId)
		await dialog.getByRole('button', { name: 'Pridať člena' }).click()
		expect((await added).status()).toBe(201)

		await expect(page.getByText(`Člen ${member.email} bol pridaný do projektu.`)).toBeVisible()
		await expect(dialog).toBeHidden()
		await expect(table.getByRole('row').filter({ hasText: member.email })).toBeVisible()

		const context = await browser.newContext({ baseURL, storageState: ANONYMOUS })
		const memberPage = await context.newPage()
		await loginViaUi(memberPage, member)
		await expectLoggedInHome(memberPage)
		await expectSeesOnlyProject(memberPage, editor.projectSlug)
		await context.close()
	})

	test('creates a new user from the modal, who is preselected and then added as a Návštevník', async ({ page, playwright, baseURL }) => {
		const editor = await createEditor(playwright.request, baseURL)
		const credentials = newTestUserCredentials()
		await openMembersPage(page, editor.projectSlug)

		const dialog = await openAddModal(page)
		await dialog.getByRole('button', { name: 'Vytvoriť nového používateľa' }).click()
		const createDialog = page.getByRole('dialog', { name: 'Nový používateľ' })
		await expect(createDialog).toBeVisible()
		await expect(createDialog.getByRole('switch', { name: /^Administrátor/ })).not.toBeChecked()
		await createDialog.getByLabel('E-mail', { exact: true }).fill(credentials.email)
		await createDialog.getByLabel('Heslo', { exact: true }).fill(credentials.password)
		const created = page.waitForResponse((response) => response.url().endsWith('/api/admin/users') && response.request().method() === 'POST')
		await createDialog.getByRole('button', { name: 'Vytvoriť používateľa' }).click()
		expect((await created).status()).toBe(201)
		await expect(createDialog).toBeHidden()

		await expect(dialog.getByLabel('Používateľ')).toHaveValue(credentials.email)
		const role = dialog.getByRole('combobox', { name: 'Rola v projekte' })
		await expect(role).toHaveValue('Editor')
		await role.click()
		await page.getByRole('option', { name: 'Návštevník' }).click()
		const added = waitForAddResponse(page, editor.projectId)
		await dialog.getByRole('button', { name: 'Pridať člena' }).click()
		const response = await added
		expect(response.status()).toBe(201)
		expect(response.request().postDataJSON()).toMatchObject({ role: 'VISITOR' })
		// The role is in the Rola column and, for narrow screens (hidden by CSS), under the email; the first one is the visible column.
		await expect(page.getByRole('combobox', { name: `Rola používateľa ${credentials.email} v projekte` }).first()).toHaveValue('Návštevník')
	})

	test('removes a member, who then no longer sees the project; the own row has no remove', async ({ page, browser, playwright, baseURL }) => {
		const editor = await createEditor(playwright.request, baseURL)
		const table = await openMembersPage(page, editor.projectSlug)

		await expect(page.getByRole('button', { name: `Odobrať ${ADMIN_EMAIL} z projektu` })).toHaveCount(0)
		await page.getByRole('button', { name: `Odobrať ${editor.email} z projektu` }).click()
		const dialog = page.getByRole('dialog', { name: 'Odobrať z projektu' })
		const deleted = page.waitForResponse((response) => response.request().method() === 'DELETE' && response.url().includes('/members/'))
		await dialog.getByRole('button', { name: 'Odobrať' }).click()
		expect((await deleted).status()).toBe(204)

		await expect(page.getByText(`${editor.email} bol odobraný z projektu.`)).toBeVisible()
		await expect(table.getByRole('row').filter({ hasText: editor.email })).toHaveCount(0)

		const context = await browser.newContext({ baseURL, storageState: ANONYMOUS })
		const removedPage = await context.newPage()
		await loginViaUi(removedPage, editor)
		await expectLoggedInHome(removedPage)
		await expect(removedPage.getByText('Zatiaľ nie ste v žiadnom projekte. Do projektu vás pridá administrátor.')).toBeVisible()
		await context.close()
	})
})

test.describe('EDITOR', () => {
	test.use({ storageState: ANONYMOUS })

	test('sees the members list without adding or removing', async ({ page, playwright, baseURL }) => {
		const editor = await createEditor(playwright.request, baseURL)
		await loginViaUi(page, editor)
		await expectLoggedInHome(page)
		const table = await openMembersPage(page, editor.projectSlug)

		const own = table.getByRole('row').filter({ hasText: editor.email })
		await expect(own).toBeVisible()
		// The badge is in the Rola column and, for narrow screens (hidden by CSS), under the email.
		await expect(own.getByText('Editor', { exact: true }).last()).toBeVisible()
		await expect(table.getByRole('combobox')).toHaveCount(0)
		await expect(table.getByRole('row').filter({ hasText: ADMIN_EMAIL })).toHaveCount(0)
		await expect(page.getByRole('button', { name: 'Pridať člena' })).toHaveCount(0)
		await expect(page.getByRole('button', { name: /^Odobrať .* z projektu$/ })).toHaveCount(0)
	})
})
