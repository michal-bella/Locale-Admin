import { expect, type Page, test } from '@playwright/test'

import { MUTATION_HEADERS, readApiError } from '../support/api'
import { ANONYMOUS, expectLoggedInHome, loginViaUi, STORAGE_STATE } from '../support/auth'
import { ADMIN_EMAIL } from '../support/env'
import { getSidebar, openUserMenu } from '../support/layout'
import { createEditor, type TestUser } from '../support/users'

type Profile = { id: string; email: string; role: 'ADMIN' | 'EDITOR'; firstName: string | null; lastName: string | null; passwordChangedAt: string }

const PROFILE_HEADING = { level: 1, name: 'Môj profil' } as const

const openProfileFromMenu = async (page: Page) => {
	await page.goto('/')
	const item = (await openUserMenu(page)).getByRole('menuitem', { name: 'Môj profil' })
	await expect(item).toHaveAttribute('href', '/profile')
	await item.click()
	await expect(page).toHaveURL('/profile')
	await expect(page.getByRole('heading', PROFILE_HEADING)).toBeVisible()
}

const getProfile = async (page: Page) => {
	const response = await page.request.get('/api/profile')
	expect(response.status(), 'GET /api/profile').toBe(200)
	return (await response.json()) as Profile
}

const trackProfilePatches = (page: Page) => {
	const patches: string[] = []
	page.on('request', (request) => {
		if (request.method() === 'PATCH' && request.url().endsWith('/api/profile')) {
			patches.push(request.url())
		}
	})
	return patches
}

// These tests change the name, so each one signs in as its own EDITOR and never touches the shared one or the seed admin.
test.describe('EDITOR with a dedicated user', () => {
	test.use({ storageState: ANONYMOUS })

	let editor: TestUser

	test.beforeEach(async ({ page, playwright, baseURL }) => {
		editor = await createEditor(playwright.request, baseURL)
		await loginViaUi(page, editor)
		await expectLoggedInHome(page)
	})

	test('changes the name from the menu, the sidebar updates without a reload and the name persists', async ({ page }) => {
		await openProfileFromMenu(page)
		await page.evaluate(() => Object.assign(window, { e2eNoReload: true }))

		const sidebar = getSidebar(page)
		const firstName = page.getByLabel('Meno', { exact: true })
		const lastName = page.getByLabel('Priezvisko', { exact: true })
		const save = page.getByRole('button', { name: 'Uložiť profil' })

		await expect(sidebar.getByText(editor.email.slice(0, 2).toUpperCase(), { exact: true })).toBeVisible()
		await expect(sidebar.getByText(editor.email, { exact: true })).toBeVisible()
		await expect(page.getByRole('heading', { level: 2, name: editor.email })).toBeVisible()
		await expect(page.getByRole('main').getByText('Člen', { exact: true })).toBeVisible()
		await expect(firstName).toHaveValue('')
		await expect(lastName).toHaveValue('')
		await expect(save).toBeDisabled()

		await firstName.fill('  Ľubomír ')
		await lastName.fill('Šťastný')
		await expect(save).toBeEnabled()
		const patch = page.waitForResponse((response) => response.url().endsWith('/api/profile') && response.request().method() === 'PATCH')
		await save.click()
		expect((await patch).status()).toBe(200)

		await expect(page.getByText('Profil bol uložený.')).toBeVisible()
		await expect(sidebar.getByText('ĽŠ', { exact: true })).toBeVisible()
		await expect(sidebar.getByText('Ľubomír Šťastný', { exact: true })).toBeVisible()
		await expect(sidebar.getByText(editor.email, { exact: true })).toHaveCount(0)
		await expect(page.getByRole('heading', { level: 2, name: 'Ľubomír Šťastný' })).toBeVisible()
		await expect(firstName).toHaveValue('Ľubomír')
		await expect(save).toBeDisabled()
		expect(await page.evaluate(() => 'e2eNoReload' in window)).toBe(true)

		await page.reload()
		await expect(page.getByRole('heading', PROFILE_HEADING)).toBeVisible()
		await expect(page.getByLabel('Meno', { exact: true })).toHaveValue('Ľubomír')
		await expect(page.getByLabel('Priezvisko', { exact: true })).toHaveValue('Šťastný')
		await expect(getSidebar(page).getByText('ĽŠ', { exact: true })).toBeVisible()
		expect(await getProfile(page)).toMatchObject({ email: editor.email, role: 'EDITOR', firstName: 'Ľubomír', lastName: 'Šťastný' })
	})

	test('blank or too long names show translated field errors and nothing is saved', async ({ page }) => {
		await page.goto('/profile')
		await expect(page.getByRole('heading', PROFILE_HEADING)).toBeVisible()
		const patches = trackProfilePatches(page)

		const firstName = page.getByLabel('Meno', { exact: true })
		const lastName = page.getByLabel('Priezvisko', { exact: true })
		const save = page.getByRole('button', { name: 'Uložiť profil' })

		await firstName.fill('   ')
		await lastName.fill('a'.repeat(101))
		await save.click()

		await expect(firstName).toHaveAttribute('aria-invalid', 'true')
		await expect(firstName).toHaveAccessibleDescription('Toto pole je povinné.')
		await expect(lastName).toHaveAttribute('aria-invalid', 'true')
		await expect(lastName).toHaveAccessibleDescription('Zadajte najviac 100 znakov.')
		await expect(page.getByText('Profil bol uložený.')).toBeHidden()
		expect(patches).toEqual([])
		expect(await getProfile(page)).toMatchObject({ firstName: null, lastName: null })
	})
})

test.describe('EDITOR', () => {
	test.use({ storageState: STORAGE_STATE.EDITOR })

	test('opens the profile from the menu with the disabled controls', async ({ page }) => {
		await openProfileFromMenu(page)
		const profile = await getProfile(page)
		expect(profile.role).toBe('EDITOR')

		const email = page.getByLabel('E-mailová adresa', { exact: true })
		await expect(email).toHaveValue(profile.email)
		await expect(email).toBeDisabled()
		const position = page.getByLabel('Pracovná pozícia', { exact: true })
		await expect(position).toHaveValue('')
		await expect(position).toHaveAttribute('placeholder', 'Napr. Product manager')
		await expect(position).toBeDisabled()

		for (const name of [/^Zmienky a komentáre/, /^Preklady na kontrolu/, /^Importy a exporty/]) {
			const toggle = page.getByRole('switch', { name })
			await expect(toggle).toBeDisabled()
			await expect(toggle).not.toBeChecked()
		}

		await expect(page.getByRole('button', { name: 'Zmeniť fotografiu' })).toBeDisabled()
		await expect(page.getByRole('button', { name: 'Zmeniť heslo' })).toBeDisabled()
		await expect(page.getByRole('button', { name: 'Uložiť profil' })).toBeDisabled()
		await expect(page.getByText(/^Heslo bolo naposledy zmenené /)).toBeVisible()
	})

	test('Jazyk rozhrania switches the UI language immediately without saving', async ({ page }) => {
		await page.goto('/profile')
		await expect(page.getByRole('heading', PROFILE_HEADING)).toBeVisible()
		await page.evaluate(() => Object.assign(window, { e2eNoReload: true }))
		const patches = trackProfilePatches(page)

		const language = page.getByLabel('Jazyk rozhrania', { exact: true })
		await expect(language).toHaveValue('Slovenčina')
		await language.click()
		await page.getByRole('option', { name: 'English' }).click()

		await expect(page.getByRole('heading', { level: 1, name: 'My profile' })).toBeVisible()
		await expect(page.getByRole('button', { name: 'Save profile' })).toBeDisabled()
		await expect(page.getByLabel('Interface language', { exact: true })).toHaveValue('English')
		await expect(page.getByRole('radiogroup', { name: 'Language' }).getByRole('radio', { name: 'English' })).toBeChecked()
		await expect(page.getByText(/^Password was last changed /)).toBeVisible()
		expect(await page.evaluate(() => localStorage.getItem('locale'))).toBe('en')
		expect(await page.evaluate(() => 'e2eNoReload' in window)).toBe(true)
		expect(patches).toEqual([])

		await page.getByLabel('Interface language', { exact: true }).click()
		await page.getByRole('option', { name: 'Slovenčina' }).click()
		await expect(page.getByRole('heading', PROFILE_HEADING)).toBeVisible()
		expect(await page.evaluate(() => localStorage.getItem('locale'))).toBe('sk')
	})
})

test.describe('ADMIN', () => {
	test.use({ storageState: STORAGE_STATE.ADMIN })

	test('opens the profile from the menu', async ({ page }) => {
		await openProfileFromMenu(page)
		await expect(page.getByLabel('E-mailová adresa', { exact: true })).toHaveValue(ADMIN_EMAIL)
		await expect(page.getByRole('main').getByText('Administrátor', { exact: true })).toBeVisible()
		await expect(page.getByRole('button', { name: 'Uložiť profil' })).toBeDisabled()
		expect(await getProfile(page)).toMatchObject({ email: ADMIN_EMAIL, role: 'ADMIN' })
	})
})

test.describe('anonymous', () => {
	test.use({ storageState: ANONYMOUS })

	test('/profile redirects to /login', async ({ page }) => {
		await page.goto('/profile')
		await expect(page).toHaveURL('/login')
		await expect(page.getByRole('heading', { level: 1, name: 'Vitajte späť' })).toBeVisible()
	})

	test('GET and PATCH /api/profile return 401 AUTH_UNAUTHENTICATED', async ({ request }) => {
		const read = await request.get('/api/profile')
		expect(read.status()).toBe(401)
		expect((await readApiError(read)).code).toBe('AUTH_UNAUTHENTICATED')

		const update = await request.patch('/api/profile', { data: { firstName: 'Anna', lastName: 'Nová' }, headers: MUTATION_HEADERS })
		expect(update.status()).toBe(401)
		expect((await readApiError(update)).code).toBe('AUTH_UNAUTHENTICATED')
	})
})
