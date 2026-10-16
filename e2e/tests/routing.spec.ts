import { expect, test } from '@playwright/test'

import { ANONYMOUS, expectLoggedInHome, STORAGE_STATE } from '../support/auth'

test.describe('anonymous', () => {
	test.use({ storageState: ANONYMOUS })

	for (const path of ['/', '/admin/users']) {
		test(`${path} redirects to /login`, async ({ page }) => {
			await page.goto(path)
			await expect(page).toHaveURL('/login')
			await expect(page.getByRole('heading', { level: 1, name: 'Vitajte späť' })).toBeVisible()
		})
	}

	test('unknown route shows the 404 page', async ({ page }) => {
		await page.goto('/this-route-does-not-exist')
		await expect(page.getByRole('heading', { level: 1, name: 'Stránka sa nenašla' })).toBeVisible()
		await expect(page).toHaveURL('/this-route-does-not-exist')
	})
})

test.describe('ADMIN', () => {
	test.use({ storageState: STORAGE_STATE.ADMIN })

	test('/login redirects to /', async ({ page }) => {
		await page.goto('/login')
		await expectLoggedInHome(page)
	})

	test('sees the top bar and the Používatelia menu item', async ({ page }) => {
		await page.goto('/')
		await expect(page.getByRole('img', { name: 'Notifikácie' })).toBeVisible()
		await expect(page.getByRole('radiogroup', { name: 'Jazyk' })).toBeVisible()
		await page.getByRole('button', { name: 'Menu používateľa' }).click()
		const users = page.getByRole('menuitem', { name: 'Používatelia' })
		await expect(users).toHaveAttribute('href', '/admin/users')
		await users.click()
		await expect(page).toHaveURL('/admin/users')
		await expect(page.getByRole('heading', { level: 1, name: 'Používatelia' })).toBeVisible()
	})

	test('/admin/users survives a reload (no nginx 404)', async ({ page }) => {
		const response = await page.goto('/admin/users')
		expect(response?.status()).toBe(200)
		await expect(page.getByRole('heading', { level: 1, name: 'Používatelia' })).toBeVisible()

		const reloaded = await page.reload()
		expect(reloaded?.status()).toBe(200)
		expect(reloaded?.headers()['content-type']).toContain('text/html')
		await expect(page.getByRole('heading', { level: 1, name: 'Používatelia' })).toBeVisible()
	})
})

test.describe('EDITOR', () => {
	test.use({ storageState: STORAGE_STATE.EDITOR })

	test('/login redirects to /', async ({ page }) => {
		await page.goto('/login')
		await expectLoggedInHome(page)
	})

	test('does not see the Používatelia menu item', async ({ page }) => {
		await page.goto('/')
		await page.getByRole('button', { name: 'Menu používateľa' }).click()
		await expect(page.getByRole('menuitem', { name: 'Odhlásiť' })).toBeVisible()
		await expect(page.getByRole('menuitem', { name: 'Používatelia' })).toHaveCount(0)
	})

	test('/admin/users shows the 403 page', async ({ page }) => {
		await page.goto('/admin/users')
		await expect(page.getByRole('heading', { level: 1, name: 'Prístup zamietnutý' })).toBeVisible()
		await expect(page).toHaveURL('/admin/users')
		await expect(page.getByRole('heading', { level: 1, name: 'Používatelia' })).toHaveCount(0)
	})
})
