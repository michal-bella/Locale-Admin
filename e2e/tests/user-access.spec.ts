import { type APIRequest, type APIRequestContext, expect, test } from '@playwright/test'

import { MUTATION_HEADERS, readApiError } from '../support/api'
import { ANONYMOUS, type Credentials, expectLoggedInHome, loginViaUi } from '../support/auth'
import { createMember, newTestUserCredentials } from '../support/users'

/** A separate API client signed in as the user, standing in for their other browser or device. */
const signInElsewhere = async (request: APIRequest, baseURL: string | undefined, credentials: Credentials) => {
	const api = await request.newContext({ baseURL, storageState: ANONYMOUS })
	const response = await api.post('/api/auth/login', { data: credentials, headers: MUTATION_HEADERS })
	expect(response.status(), 'POST /api/auth/login').toBe(200)
	return api
}

const loginStatus = async (api: APIRequestContext, credentials: Credentials) =>
	(await api.post('/api/auth/login', { data: credentials, headers: MUTATION_HEADERS })).status()

test('ADMIN sets a new password on the user detail: the user is signed out and signs in only with the new one', async ({ page, playwright, baseURL }) => {
	const member = await createMember(playwright.request, baseURL)
	const elsewhere = await signInElsewhere(playwright.request, baseURL, member)
	const { password: newPassword } = newTestUserCredentials()

	await page.goto(`/admin/users/${member.id}`)
	await expect(page.getByRole('region', { name: 'Účet používateľa' })).toContainText('Prihlásenie: heslo')
	await page.getByRole('button', { name: 'Nastaviť heslo' }).click()
	const dialog = page.getByRole('dialog', { name: 'Nastaviť heslo' })
	await dialog.getByLabel('Nové heslo', { exact: true }).fill(newPassword)
	await dialog.getByLabel('Nové heslo znova').fill(`${newPassword}x`)
	await dialog.getByRole('button', { name: 'Nastaviť heslo' }).click()
	await expect(dialog.getByText('Heslá sa nezhodujú.')).toBeVisible()

	await dialog.getByLabel('Nové heslo znova').fill(newPassword)
	const saved = page.waitForResponse((response) => response.url().endsWith(`/api/admin/users/${member.id}/password`))
	await dialog.getByRole('button', { name: 'Nastaviť heslo' }).click()
	expect((await saved).status()).toBe(200)
	await expect(page.getByText(`Heslo používateľa ${member.email} bolo nastavené.`)).toBeVisible()
	await expect(dialog).toBeHidden()

	const me = await elsewhere.get('/api/auth/me')
	expect(me.status()).toBe(401)
	expect(await loginStatus(elsewhere, member)).toBe(401)
	expect(await loginStatus(elsewhere, { email: member.email, password: newPassword })).toBe(200)
	await elsewhere.dispose()
})

test('ADMIN blocks a user, who is signed out and cannot sign in, and unblocks them again', async ({ page, playwright, baseURL }) => {
	const member = await createMember(playwright.request, baseURL)
	const elsewhere = await signInElsewhere(playwright.request, baseURL, member)

	await page.goto('/admin/users')
	await page.getByRole('link', { name: `Otvoriť používateľa ${member.email}` }).click()
	await page.getByRole('button', { name: 'Zablokovať' }).click()
	const blockDialog = page.getByRole('dialog', { name: 'Zablokovať používateľa' })
	await expect(blockDialog).toContainText(`Používateľ ${member.email} sa hneď odhlási`)
	await blockDialog.getByRole('button', { name: 'Zablokovať' }).click()
	await expect(page.getByText(`Používateľ ${member.email} bol zablokovaný.`)).toBeVisible()
	const card = page.getByRole('region', { name: 'Účet používateľa' })
	await expect(card.getByText('Zablokovaný')).toBeVisible()

	expect((await elsewhere.get('/api/auth/me')).status()).toBe(401)
	const blockedLogin = await elsewhere.post('/api/auth/login', { data: member, headers: MUTATION_HEADERS })
	expect(blockedLogin.status()).toBe(401)
	expect((await readApiError(blockedLogin)).code).toBe('AUTH_INVALID_CREDENTIALS')

	await page.goto('/admin/users')
	const row = page.getByRole('table', { name: 'Zoznam používateľov' }).getByRole('row').filter({ hasText: member.email })
	await expect(row.getByText('Zablokovaný').filter({ visible: true })).toBeVisible()
	await row.getByRole('link', { name: `Otvoriť používateľa ${member.email}` }).click()

	await page.getByRole('button', { name: 'Odblokovať' }).click()
	await page.getByRole('dialog', { name: 'Odblokovať používateľa' }).getByRole('button', { name: 'Odblokovať' }).click()
	await expect(page.getByText(`Používateľ ${member.email} bol odblokovaný.`)).toBeVisible()
	await expect(card.getByText('Zablokovaný')).toBeHidden()
	expect(await loginStatus(elsewhere, member)).toBe(200)
	await elsewhere.dispose()
})

test.describe('signed out', () => {
	test.use({ storageState: ANONYMOUS })

	test('changing the own password signs out the other devices and keeps this one', async ({ page, playwright, baseURL }) => {
		const member = await createMember(playwright.request, baseURL)
		const elsewhere = await signInElsewhere(playwright.request, baseURL, member)
		const { password: newPassword } = newTestUserCredentials()
		await loginViaUi(page, member)
		await expectLoggedInHome(page)

		await page.goto('/profile')
		await page.getByRole('button', { name: 'Zmeniť heslo' }).click()
		const dialog = page.getByRole('dialog', { name: 'Zmeniť heslo' })
		await dialog.getByLabel('Aktuálne heslo').fill(member.password)
		await dialog.getByLabel('Nové heslo', { exact: true }).fill(newPassword)
		await dialog.getByLabel('Nové heslo znova').fill(newPassword)
		await dialog.getByRole('button', { name: 'Zmeniť heslo' }).click()
		await expect(page.getByText('Heslo bolo zmenené.')).toBeVisible()

		expect((await elsewhere.get('/api/auth/me')).status()).toBe(401)
		await page.reload()
		await expect(page.getByRole('heading', { level: 1, name: 'Môj profil' })).toBeVisible()
		await elsewhere.dispose()
	})

	test('the login page offers Google exactly when the backend has it on and shows a failed Google sign-in', async ({ page }) => {
		const providers = (await (await page.request.get('/api/auth/providers')).json()) as { google: boolean }

		await page.goto('/login?error=AUTH_USER_BLOCKED')
		await expect(page.getByText('Váš účet je zablokovaný. Obráťte sa na administrátora.')).toBeVisible()
		await expect(page.getByRole('button', { name: 'Prihlásiť sa', exact: true })).toBeVisible()
		const google = page.getByRole('link', { name: 'Prihlásiť sa cez Google' })
		if (providers.google) {
			await expect(google).toHaveAttribute('href', '/api/auth/oauth/google')
		} else {
			await expect(google).toHaveCount(0)
			expect((await page.request.get('/api/auth/oauth/google', { maxRedirects: 0 })).status()).toBe(404)
		}
	})
})
