import { expect, test } from '@playwright/test'

import { ANONYMOUS, expectLoggedInHome, loginViaUi, STORAGE_STATE } from '../support/auth'
import { createProject, projectMembersApi } from '../support/projects'
import { createEditor } from '../support/users'

const UNKNOWN_USER_ID = '00000000-0000-4000-8000-000000000999'

const formatCreatedAt = (createdAt: string) =>
	new Intl.DateTimeFormat('sk-SK', { day: 'numeric', month: 'numeric', year: 'numeric' }).format(new Date(createdAt))

test('ADMIN opens a user from the table, adds them to a project, removes them from another and opens the members', async ({ page, playwright, baseURL }) => {
	const editor = await createEditor(playwright.request, baseURL)
	const api = await playwright.request.newContext({ baseURL, storageState: STORAGE_STATE.ADMIN })
	const second = await createProject(api, 'detail')
	await api.dispose()

	await page.goto('/admin/users')
	const users = page.getByRole('table', { name: 'Zoznam používateľov' })
	await expect(users).toHaveAttribute('aria-busy', 'false')
	await page.getByRole('link', { name: `Otvoriť používateľa ${editor.email}` }).click()
	await expect(page).toHaveURL(`/admin/users/${editor.id}`)

	const card = page.getByRole('region', { name: 'Účet používateľa' })
	await expect(card.getByRole('heading', { level: 2, name: editor.email })).toBeVisible()
	await expect(card).toContainText('Editor')
	await expect(card).toContainText(`Vytvorený ${formatCreatedAt(editor.createdAt)}`)
	const projects = page.getByRole('table', { name: 'Projekty používateľa' })
	const firstRow = projects.getByRole('row').filter({ hasText: editor.projectSlug })
	await expect(firstRow).toBeVisible()
	await expect(projects.getByRole('row').filter({ hasText: second.slug })).toHaveCount(0)

	await page.getByRole('button', { name: 'Pridať do projektu' }).click()
	const addDialog = page.getByRole('dialog', { name: 'Pridať do projektu' })
	await expect(addDialog).toBeVisible()
	await addDialog.getByLabel('Projekt').fill(second.name)
	await page.getByRole('option', { name: second.name }).click()
	const added = page.waitForResponse((response) => response.url().endsWith(projectMembersApi(second.id)) && response.request().method() === 'POST')
	await addDialog.getByRole('button', { name: 'Pridať do projektu' }).click()
	expect((await added).status()).toBe(201)
	await expect(page.getByText(`${editor.email} bol pridaný do projektu ${second.name}.`)).toBeVisible()
	await expect(addDialog).toBeHidden()
	const secondRow = projects.getByRole('row').filter({ hasText: second.slug })
	await expect(secondRow).toBeVisible()

	await firstRow.getByRole('button', { name: /^Odobrať z projektu / }).click()
	const removeDialog = page.getByRole('dialog', { name: 'Odobrať z projektu' })
	await expect(removeDialog).toContainText(`Naozaj chcete odobrať ${editor.email} z projektu`)
	const removed = page.waitForResponse(
		(response) => response.url().endsWith(`${projectMembersApi(editor.projectId)}/${editor.id}`) && response.request().method() === 'DELETE',
	)
	await removeDialog.getByRole('button', { name: 'Odobrať' }).click()
	expect((await removed).status()).toBe(204)
	await expect(removeDialog).toBeHidden()
	await expect(firstRow).toHaveCount(0)
	await expect(secondRow).toBeVisible()

	await secondRow.getByRole('link', { name: `Otvoriť členov projektu ${second.name}` }).click()
	await expect(page).toHaveURL(`/projects/${second.slug}/members`)
	const members = page.getByRole('table', { name: 'Zoznam členov' })
	await expect(members).toHaveAttribute('aria-busy', 'false')
	await expect(members.getByRole('row').filter({ hasText: editor.email })).toBeVisible()
})

test('an unknown user shows the not-found state with a link back to the list', async ({ page }) => {
	await page.goto(`/admin/users/${UNKNOWN_USER_ID}`)

	await expect(page.getByText('Používateľ sa nenašiel')).toBeVisible()
	await page.getByRole('link', { name: 'Späť na používateľov' }).click()
	await expect(page).toHaveURL('/admin/users')
	await expect(page.getByRole('table', { name: 'Zoznam používateľov' })).toBeVisible()
})

test.describe('EDITOR', () => {
	test.use({ storageState: ANONYMOUS })

	test('gets the 403 page on a user detail', async ({ page, playwright, baseURL }) => {
		const editor = await createEditor(playwright.request, baseURL)
		await loginViaUi(page, editor)
		await expectLoggedInHome(page)

		await page.goto(`/admin/users/${editor.id}`)

		await expect(page.getByRole('heading', { level: 1, name: 'Prístup zamietnutý' })).toBeVisible()
		await expect(page).toHaveURL(`/admin/users/${editor.id}`)
	})
})
