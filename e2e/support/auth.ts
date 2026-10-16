import path from 'node:path'

import { type BrowserContext, expect, type Page } from '@playwright/test'

export type Credentials = { email: string; password: string }

export const SESSION_COOKIE = 'locale_session'

export const STORAGE_STATE = {
	ADMIN: path.resolve(import.meta.dirname, '../.auth/admin.json'),
	EDITOR: path.resolve(import.meta.dirname, '../.auth/editor.json'),
} as const

export const ANONYMOUS = { cookies: [], origins: [] }

export const loginViaUi = async (page: Page, { email, password }: Credentials) => {
	await page.goto('/login')
	await page.getByLabel('E-mail', { exact: true }).fill(email)
	await page.getByLabel('Heslo', { exact: true }).fill(password)
	await page.getByRole('button', { name: 'Prihlásiť sa' }).click()
}

export const expectLoggedInHome = async (page: Page) => {
	await expect(page).toHaveURL('/')
	await expect(page.getByRole('button', { name: 'Menu používateľa' })).toBeVisible()
}

export const getSessionToken = async (context: BrowserContext) => {
	const cookie = (await context.cookies()).find(({ name }) => name === SESSION_COOKIE)
	expect(cookie, `${SESSION_COOKIE} cookie`).toBeDefined()
	return cookie!.value
}
