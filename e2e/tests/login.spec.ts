import { expect, test } from '@playwright/test'

import { readApiError } from '../support/api'
import { ANONYMOUS, expectLoggedInHome, getSessionToken, loginViaUi, SESSION_COOKIE } from '../support/auth'
import { countSessionsByToken, getLastLoginAt } from '../support/db'
import { ADMIN_EMAIL, getAdminPassword } from '../support/env'
import { openUserMenu } from '../support/layout'
import { createEditor } from '../support/users'

// Each test logs in on its own: logging out of the shared storageState session would break other tests.
test.use({ storageState: ANONYMOUS })

test('logs in via the UI and logs out from the user menu', async ({ page, playwright, baseURL }) => {
	await loginViaUi(page, await createEditor(playwright.request, baseURL))
	await expectLoggedInHome(page)
	const token = await getSessionToken(page.context())
	expect(await countSessionsByToken(token)).toBe(1)

	const logoutResponse = page.waitForResponse((response) => response.url().endsWith('/api/auth/logout'))
	const menu = await openUserMenu(page)
	await menu.getByRole('menuitem', { name: 'Odhlásiť sa', exact: true }).click()
	expect((await logoutResponse).status()).toBe(204)

	await expect(page).toHaveURL('/login')
	await expect(page.getByRole('heading', { level: 1, name: 'Vitajte späť' })).toBeVisible()
	expect((await page.context().cookies()).find(({ name }) => name === SESSION_COOKIE)).toBeUndefined()
	expect(await countSessionsByToken(token)).toBe(0)

	const api = await playwright.request.newContext({ baseURL, storageState: ANONYMOUS })
	const me = await api.get('/api/auth/me', { headers: { Cookie: `${SESSION_COOKIE}=${token}` } })
	expect(me.status()).toBe(401)
	expect((await readApiError(me)).code).toBe('AUTH_UNAUTHENTICATED')
	await api.dispose()
})

test('session survives a page reload', async ({ page, playwright, baseURL }) => {
	await loginViaUi(page, await createEditor(playwright.request, baseURL))
	await expectLoggedInHome(page)
	await page.reload()
	await expectLoggedInHome(page)
})

test('wrong password shows the translated error', async ({ page }) => {
	const loginResponse = page.waitForResponse((response) => response.url().endsWith('/api/auth/login'))
	await loginViaUi(page, { email: ADMIN_EMAIL, password: 'definitely-not-the-password' })
	const response = await loginResponse
	expect(response.status()).toBe(401)
	const error = await readApiError(response)
	expect(error.code).toBe('AUTH_INVALID_CREDENTIALS')

	const alert = page.getByRole('alert')
	await expect(alert).toHaveText('Nesprávny e-mail alebo heslo.')
	await expect(alert).not.toContainText(error.message)
	await expect(page).toHaveURL('/login')
})

test('admin email is case-insensitive and sets lastLoginAt', async ({ page }) => {
	const before = await getLastLoginAt(ADMIN_EMAIL)
	await loginViaUi(page, { email: 'Michal.Bella@GoodRequest.com', password: getAdminPassword() })
	await expectLoggedInHome(page)

	const after = await getLastLoginAt(ADMIN_EMAIL)
	expect(after).not.toBeNull()
	if (before) {
		expect(after!.getTime()).toBeGreaterThan(before.getTime())
	}
})
