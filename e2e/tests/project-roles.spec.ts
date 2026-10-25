import { expect, test } from '@playwright/test'

import { ANONYMOUS } from '../support/auth'
import { newAdminApi } from '../support/languages'
import { getMainNavigation } from '../support/layout'
import { createProject } from '../support/projects'
import { addMember, createMember, loginViaApi } from '../support/users'

test.use({ storageState: ANONYMOUS })

test('one user manages one project and only reads another; the profile lists both roles', async ({ page, playwright, baseURL }) => {
	const user = await createMember(playwright.request, baseURL)
	const admin = await newAdminApi(playwright.request)
	const managed = await createProject(admin, 'roles-managed')
	const visited = await createProject(admin, 'roles-visited')
	await addMember(admin, managed.id, user.id, 'MANAGER')
	await addMember(admin, visited.id, user.id, 'VISITOR')
	await admin.dispose()
	await loginViaApi(page, user)

	await page.goto(`/projects/${managed.slug}/settings`)
	await expect(page.getByRole('heading', { level: 1, name: 'Nastavenia projektu' })).toBeVisible()
	await expect(getMainNavigation(page).getByRole('list', { name: managed.name }).getByRole('link')).toHaveText([
		'Prehľad',
		'Preklady',
		'Verzie',
		'História',
		'Jazyky',
		'Členovia',
		'Nastavenia',
	])
	await expect(page.getByLabel('Názov projektu', { exact: true })).toBeEnabled()
	await expect(getMainNavigation(page).getByText('Správa')).toHaveCount(0)

	await page.goto(`/projects/${visited.slug}/settings`)
	await expect(page.getByRole('heading', { level: 1, name: 'Prístup zamietnutý' })).toBeVisible()
	await expect(getMainNavigation(page).getByRole('list', { name: visited.name }).getByRole('link')).toHaveText(['Prehľad', 'Preklady', 'História'])

	await page.goto('/profile')
	await expect(page.getByRole('switch', { name: /^Administrátor/ })).toHaveCount(0)
	const projects = page.getByRole('list', { name: 'Moje projekty a roly' }).getByRole('listitem')
	await expect(projects.filter({ hasText: managed.name })).toContainText('Správca')
	await expect(projects.filter({ hasText: visited.name })).toContainText('Návštevník')
})
