import { expect, type Page, test } from '@playwright/test'

import { ANONYMOUS } from '../support/auth'

const COLOR_SCHEME_KEY = 'mantine-color-scheme-value'

const readColorScheme = (page: Page) => page.evaluate((key) => localStorage.getItem(key), COLOR_SCHEME_KEY)

const readBodyBackground = (page: Page) => page.locator('body').evaluate((body) => getComputedStyle(body).backgroundColor)

const openUsersPage = async (page: Page) => {
	await page.goto('/admin/users')
	await expect(page.getByRole('heading', { level: 1, name: 'Používatelia' })).toBeVisible()
}

test.describe('logged in', () => {
	test('toggles light/dark without a reload and keeps the choice after a reload', async ({ page }) => {
		await openUsersPage(page)
		const html = page.locator('html')
		// The shared ADMIN storageState must not carry a dark scheme into other tests.
		expect(await readColorScheme(page)).not.toBe('dark')
		await expect(html).toHaveAttribute('data-mantine-color-scheme', 'light')
		await page.evaluate(() => Object.assign(window, { e2eNoReload: true }))

		await page.getByRole('button', { name: 'Prepnúť na tmavý režim' }).click()

		await expect(html).toHaveAttribute('data-mantine-color-scheme', 'dark')
		await expect(page.getByRole('button', { name: 'Prepnúť na svetlý režim' })).toBeVisible()
		await expect(page.getByRole('button', { name: 'Prepnúť na tmavý režim' })).toHaveCount(0)
		expect(await page.evaluate(() => 'e2eNoReload' in window)).toBe(true)
		expect(await readColorScheme(page)).toBe('dark')

		await page.reload()
		await expect(page.getByRole('heading', { level: 1, name: 'Používatelia' })).toBeVisible()
		await expect(html).toHaveAttribute('data-mantine-color-scheme', 'dark')

		await page.getByRole('button', { name: 'Prepnúť na svetlý režim' }).click()
		await expect(html).toHaveAttribute('data-mantine-color-scheme', 'light')
		await expect(page.getByRole('button', { name: 'Prepnúť na tmavý režim' })).toBeVisible()
		expect(await readColorScheme(page)).toBe('light')
	})

	test('changes the body background between light and dark', async ({ page }) => {
		await openUsersPage(page)
		const body = page.locator('body')
		const lightBackground = await readBodyBackground(page)

		await page.getByRole('button', { name: 'Prepnúť na tmavý režim' }).click()
		await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', 'dark')
		await expect(body).not.toHaveCSS('background-color', lightBackground)

		// Read the dark value after a reload so a possible CSS transition cannot yield an intermediate color.
		await page.reload()
		await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', 'dark')
		const darkBackground = await readBodyBackground(page)
		expect(darkBackground).not.toBe(lightBackground)

		await page.getByRole('button', { name: 'Prepnúť na svetlý režim' }).click()
		await expect(body).toHaveCSS('background-color', lightBackground)
	})
})

test.describe('logged out', () => {
	test.use({ storageState: ANONYMOUS })

	test('applies a stored dark scheme on the login page', async ({ page }) => {
		const heading = page.getByRole('heading', { level: 1, name: 'Vitajte späť' })
		await page.goto('/login')
		await expect(heading).toBeVisible()
		await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', 'light')
		const lightBackground = await readBodyBackground(page)

		await page.addInitScript((key) => localStorage.setItem(key, 'dark'), COLOR_SCHEME_KEY)
		await page.reload()

		await expect(heading).toBeVisible()
		await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', 'dark')
		await expect(page.locator('body')).not.toHaveCSS('background-color', lightBackground)
	})
})
