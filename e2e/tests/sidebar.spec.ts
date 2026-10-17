import { expect, type Page, test } from '@playwright/test'

import { STORAGE_STATE } from '../support/auth'
import { getMainNavigation, getSidebar, openUserMenu } from '../support/layout'

type Me = { email: string; firstName: string | null; lastName: string | null }

const getMe = async (page: Page) => {
	const response = await page.request.get('/api/auth/me')
	expect(response.status(), 'GET /api/auth/me').toBe(200)
	return (await response.json()) as Me
}

// Same rules as getInitials in @locale/shared and the name line of the user block.
const describeUser = ({ email, firstName, lastName }: Me) => {
	const first = firstName?.trim().charAt(0) ?? ''
	const last = lastName?.trim().charAt(0) ?? ''
	return {
		initials: (first && last ? `${first}${last}` : email.slice(0, 2)).toUpperCase(),
		displayName: [firstName, lastName].filter(Boolean).join(' ') || email,
	}
}

const expectUserBlock = async (page: Page, role: string) => {
	const { initials, displayName } = describeUser(await getMe(page))
	const sidebar = getSidebar(page)
	await expect(sidebar.getByText(initials, { exact: true })).toBeVisible()
	await expect(sidebar.getByText(displayName, { exact: true })).toBeVisible()
	await expect(sidebar.getByText(role, { exact: true })).toBeVisible()
}

test.describe('ADMIN', () => {
	test.use({ storageState: STORAGE_STATE.ADMIN })

	test('sees Jazyky and, under Správa, Používatelia and Nastavenia projektu; the link of the current page has aria-current', async ({ page }) => {
		await page.goto('/')
		const navigation = getMainNavigation(page)
		const languages = navigation.getByRole('link', { name: 'Jazyky' })
		const admin = navigation.getByRole('list', { name: 'Správa' })
		const users = admin.getByRole('link', { name: 'Používatelia' })
		const projectSettings = admin.getByRole('link', { name: 'Nastavenia projektu' })

		await expect(navigation.getByRole('link')).toHaveCount(3)
		await expect(admin.getByRole('link')).toHaveText(['Používatelia', 'Nastavenia projektu'])
		await expect(languages).toHaveAttribute('href', '/languages')
		await expect(users).toHaveAttribute('href', '/admin/users')
		await expect(projectSettings).toHaveAttribute('href', '/project-settings')
		await expect(languages).not.toHaveAttribute('aria-current')
		await expect(users).not.toHaveAttribute('aria-current')
		await expect(projectSettings).not.toHaveAttribute('aria-current')

		await languages.click()
		await expect(page).toHaveURL('/languages')
		await expect(page.getByRole('heading', { level: 1, name: 'Jazyky' })).toBeVisible()
		await expect(languages).toHaveAttribute('aria-current', 'page')
		await expect(users).not.toHaveAttribute('aria-current')

		await users.click()
		await expect(page).toHaveURL('/admin/users')
		await expect(page.getByRole('heading', { level: 1, name: 'Používatelia' })).toBeVisible()
		await expect(users).toHaveAttribute('aria-current', 'page')
		await expect(languages).not.toHaveAttribute('aria-current')

		await projectSettings.click()
		await expect(page).toHaveURL('/project-settings')
		await expect(page.getByRole('heading', { level: 1, name: 'Nastavenia projektu' })).toBeVisible()
		await expect(projectSettings).toHaveAttribute('aria-current', 'page')
		await expect(users).not.toHaveAttribute('aria-current')
	})

	test('user block shows initials, name and role; its menu has only Môj profil and Odhlásiť sa', async ({ page }) => {
		await page.goto('/')
		await expectUserBlock(page, 'Administrátor')

		const menu = await openUserMenu(page)
		await expect(menu.getByText((await getMe(page)).email, { exact: true })).toBeVisible()
		await expect(menu.getByRole('menuitem')).toHaveText(['Môj profil', 'Odhlásiť sa'])
		await expect(menu.getByRole('menuitem', { name: 'Môj profil' })).toHaveAttribute('href', '/profile')
	})

	test('top bar has the language and theme switchers and the bell, but no user menu', async ({ page }) => {
		await page.goto('/')
		const topBar = page.getByRole('banner')
		await expect(topBar.getByRole('radiogroup', { name: 'Jazyk' })).toBeVisible()
		await expect(topBar.getByRole('button', { name: 'Prepnúť na tmavý režim' })).toBeVisible()
		await expect(topBar.getByRole('img', { name: 'Notifikácie' })).toBeVisible()
		await expect(topBar.getByRole('button', { name: 'Menu používateľa' })).toHaveCount(0)
		await expect(topBar.getByRole('button', { name: 'Otvoriť navigáciu' })).toBeHidden()
	})
})

test.describe('EDITOR', () => {
	test.use({ storageState: STORAGE_STATE.EDITOR })

	test('sees an empty navigation and the user block with the email and the Editor role', async ({ page }) => {
		await page.goto('/')
		const navigation = getMainNavigation(page)
		await expect(navigation).toBeAttached()
		await expect(navigation.getByRole('link')).toHaveCount(0)
		await expect(navigation.getByText('Správa')).toHaveCount(0)
		await expectUserBlock(page, 'Editor')

		const menu = await openUserMenu(page)
		await expect(menu.getByRole('menuitem')).toHaveText(['Môj profil', 'Odhlásiť sa'])
	})
})

test.describe('narrow viewport', () => {
	test.use({ storageState: STORAGE_STATE.ADMIN, viewport: { width: 390, height: 844 } })

	test('the burger opens the sidebar, the close button and a link close it', async ({ page }) => {
		await page.goto('/')
		const open = page.getByRole('button', { name: 'Otvoriť navigáciu', exact: true })
		const close = getSidebar(page).getByRole('button', { name: 'Zavrieť navigáciu', exact: true })
		const users = getMainNavigation(page).getByRole('link', { name: 'Používatelia' })

		await expect(open).toBeVisible()
		await expect(open).toHaveAttribute('aria-expanded', 'false')
		await expect(users).toBeHidden()

		await open.click()
		await expect(open).toHaveAttribute('aria-expanded', 'true')
		await expect(users).toBeVisible()
		await close.click()
		await expect(users).toBeHidden()
		await expect(open).toHaveAttribute('aria-expanded', 'false')

		await open.click()
		await users.click()
		await expect(page).toHaveURL('/admin/users')
		await expect(page.getByRole('heading', { level: 1, name: 'Používatelia' })).toBeVisible()
		await expect(users).toBeHidden()
		await expect(open).toHaveAttribute('aria-expanded', 'false')
	})
})
