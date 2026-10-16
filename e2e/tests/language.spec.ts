import { expect, test } from '@playwright/test'

test('switches SK/EN without a reload and keeps the choice after a reload', async ({ page }) => {
	await page.goto('/admin/users')
	await expect(page.getByRole('heading', { level: 1, name: 'Používatelia' })).toBeVisible()
	await page.evaluate(() => Object.assign(window, { e2eNoReload: true }))

	const switcher = page.getByRole('radiogroup', { name: 'Jazyk' })
	await expect(switcher.getByRole('radio', { name: 'Slovenčina' })).toBeChecked()
	// WebKit does not reliably click the visually hidden radio input; click its visible label text instead.
	await switcher.getByText('EN', { exact: true }).click()

	await expect(page.getByRole('heading', { level: 1, name: 'Users' })).toBeVisible()
	await expect(page.getByRole('button', { name: 'User menu' })).toBeVisible()
	await expect(page.getByRole('radiogroup', { name: 'Language' }).getByRole('radio', { name: 'English' })).toBeChecked()
	expect(await page.evaluate(() => 'e2eNoReload' in window)).toBe(true)
	expect(await page.evaluate(() => localStorage.getItem('locale'))).toBe('en')

	await page.reload()
	await expect(page.getByRole('heading', { level: 1, name: 'Users' })).toBeVisible()
	await expect(page.getByRole('img', { name: 'Notifications' })).toBeVisible()

	await page.getByRole('radiogroup', { name: 'Language' }).getByText('SK', { exact: true }).click()
	await expect(page.getByRole('heading', { level: 1, name: 'Používatelia' })).toBeVisible()
	await expect(page.getByRole('radiogroup', { name: 'Jazyk' }).getByRole('radio', { name: 'Slovenčina' })).toBeChecked()
	expect(await page.evaluate(() => localStorage.getItem('locale'))).toBe('sk')
})

test('shows a decorative flag in each language item and the EN label still switches the UI', async ({ page }) => {
	await page.goto('/admin/users')
	await expect(page.getByRole('heading', { level: 1, name: 'Používatelia' })).toBeVisible()

	const switcher = page.getByRole('radiogroup', { name: 'Jazyk' })
	for (const { code, name } of [
		{ code: 'SK', name: 'Slovenčina' },
		{ code: 'EN', name: 'English' },
	]) {
		await expect(switcher.getByRole('radio', { name, exact: true })).toHaveCount(1)
		const item = switcher.locator('label', { has: page.getByText(code, { exact: true }) })
		const flag = item.locator('svg')
		await expect(flag).toHaveCount(1)
		await expect(flag).toBeVisible()
		expect(await flag.evaluate((svg) => svg.closest('[aria-hidden="true"]') !== null), `${code} flag is aria-hidden`).toBe(true)
	}

	await switcher.getByText('EN', { exact: true }).click()
	await expect(page.getByRole('heading', { level: 1, name: 'Users' })).toBeVisible()
	await expect(page.getByRole('radiogroup', { name: 'Language' }).getByRole('radio', { name: 'English', exact: true })).toBeChecked()
	await expect(page.getByRole('button', { name: 'Switch to dark mode' })).toBeVisible()
})
