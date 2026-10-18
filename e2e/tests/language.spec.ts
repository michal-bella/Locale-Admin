import { expect, type Page, test } from '@playwright/test'

const getSwitcher = (page: Page, label: string) => page.getByRole('combobox', { name: label, exact: true })

const pickLanguage = async (page: Page, label: string, language: string) => {
	await getSwitcher(page, label).click()
	await page.getByRole('option', { name: language, exact: true }).click()
}

test('switches the UI language without a reload and keeps the choice after a reload', async ({ page }) => {
	await page.goto('/admin/users')
	await expect(page.getByRole('heading', { level: 1, name: 'Používatelia' })).toBeVisible()
	await page.evaluate(() => Object.assign(window, { e2eNoReload: true }))

	await expect(getSwitcher(page, 'Jazyk')).toHaveValue('Slovenčina')
	await pickLanguage(page, 'Jazyk', 'English')

	await expect(page.getByRole('heading', { level: 1, name: 'Users' })).toBeVisible()
	await expect(page.getByRole('button', { name: 'User menu' })).toBeVisible()
	await expect(getSwitcher(page, 'Language')).toHaveValue('English')
	expect(await page.evaluate(() => 'e2eNoReload' in window)).toBe(true)
	expect(await page.evaluate(() => localStorage.getItem('locale'))).toBe('en')

	await page.reload()
	await expect(page.getByRole('heading', { level: 1, name: 'Users' })).toBeVisible()
	await expect(getSwitcher(page, 'Language')).toHaveValue('English')

	await pickLanguage(page, 'Language', 'Slovenčina')
	await expect(page.getByRole('heading', { level: 1, name: 'Používatelia' })).toBeVisible()
	expect(await page.evaluate(() => localStorage.getItem('locale'))).toBe('sk')
})

test('offers Slovak, Czech and English with decorative flags and switches to Czech', async ({ page }) => {
	await page.goto('/admin/users')
	await expect(page.getByRole('heading', { level: 1, name: 'Používatelia' })).toBeVisible()

	await getSwitcher(page, 'Jazyk').click()
	const options = page.getByRole('listbox', { name: 'Jazyk' }).getByRole('option')
	await expect(options).toHaveText(['Slovenčina', 'Čeština', 'English'])
	for (const option of await options.all()) {
		const flag = option.locator('svg')
		await expect(flag).toBeVisible()
		await expect(flag).toHaveAttribute('aria-hidden', 'true')
	}

	await page.getByRole('option', { name: 'Čeština', exact: true }).click()
	await expect(page.getByRole('heading', { level: 1, name: 'Uživatelé' })).toBeVisible()
	await expect(page.getByRole('button', { name: 'Přepnout na tmavý režim' })).toBeVisible()
	await expect(page.getByRole('table', { name: 'Seznam administrátorů' }).getByRole('cell').nth(1)).toHaveText(/^\d{1,2}\.\s?\d{1,2}\.\s?\d{4}$/)
})
