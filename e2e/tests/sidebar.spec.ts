import { expect, type Page, test } from '@playwright/test'

import { STORAGE_STATE } from '../support/auth'
import { newAdminApi } from '../support/languages'
import { getMainNavigation, getSidebar, openUserMenu } from '../support/layout'
import { createProject } from '../support/projects'

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

	test('outside a project sees Všetky projekty and, under Správa, Projekty and Používatelia; the current link has aria-current', async ({ page }) => {
		await page.goto('/profile')
		const navigation = getMainNavigation(page)
		const admin = navigation.getByRole('list', { name: 'Správa' })
		const allProjects = navigation.getByRole('link', { name: 'Všetky projekty' })
		const adminProjects = admin.getByRole('link', { name: 'Projekty' })
		const users = admin.getByRole('link', { name: 'Používatelia' })

		await expect(navigation.getByRole('link')).toHaveCount(3)
		await expect(admin.getByRole('link')).toHaveText(['Projekty', 'Používatelia'])
		await expect(allProjects).toHaveAttribute('href', '/')
		await expect(adminProjects).toHaveAttribute('href', '/admin/projects')
		await expect(users).toHaveAttribute('href', '/admin/users')
		await expect(users).not.toHaveAttribute('aria-current')

		await users.click()
		await expect(page).toHaveURL('/admin/users')
		await expect(page.getByRole('heading', { level: 1, name: 'Používatelia' })).toBeVisible()
		await expect(users).toHaveAttribute('aria-current', 'page')
		await expect(allProjects).not.toHaveAttribute('aria-current')

		await allProjects.click()
		await expect(page).toHaveURL('/')
		await expect(page.getByRole('heading', { level: 1, name: 'Projekty' })).toBeVisible()
		await expect(getSidebar(page)).toHaveCount(0)
	})

	test('inside a project sees the switcher with Preklady, Nastavenia projektu and Členovia; switching keeps the page, from settings opens translations', async ({
		page,
		playwright,
	}) => {
		const api = await newAdminApi(playwright.request)
		const project = await createProject(api, 'sidebar')
		const other = await createProject(api, 'sidebar-other')
		await api.dispose()

		await page.goto(`/projects/${project.slug}/settings`)
		const section = getMainNavigation(page).getByRole('list', { name: project.name })
		const settings = section.getByRole('link', { name: 'Nastavenia projektu' })
		const members = section.getByRole('link', { name: 'Členovia' })
		await expect(section.getByRole('link')).toHaveText(['Preklady', 'Nastavenia projektu', 'Jazyky', 'Členovia'])
		await expect(settings).toHaveAttribute('aria-current', 'page')

		await members.click()
		await expect(page).toHaveURL(`/projects/${project.slug}/members`)
		await expect(page.getByRole('heading', { level: 1, name: 'Členovia' })).toBeVisible()
		await expect(members).toHaveAttribute('aria-current', 'page')
		await expect(settings).not.toHaveAttribute('aria-current')
		await expect(getMainNavigation(page).getByRole('link', { name: 'Všetky projekty' })).toHaveCount(0)

		const switcher = getSidebar(page).getByRole('button', { name: `Prepnúť projekt, aktuálny ${project.name}` })
		await expect(switcher).toContainText(project.slug)
		await switcher.click()
		await page.getByRole('menu').getByRole('menuitem', { name: other.name }).click()
		await expect(page).toHaveURL(`/projects/${other.slug}/members`)
		await expect(getSidebar(page).getByRole('button', { name: `Prepnúť projekt, aktuálny ${other.name}` })).toBeVisible()

		await getMainNavigation(page).getByRole('list', { name: other.name }).getByRole('link', { name: 'Nastavenia projektu' }).click()
		await expect(page).toHaveURL(`/projects/${other.slug}/settings`)
		await getSidebar(page)
			.getByRole('button', { name: `Prepnúť projekt, aktuálny ${other.name}` })
			.click()
		await page.getByRole('menu').getByRole('menuitem', { name: project.name }).click()
		await expect(page).toHaveURL(`/projects/${project.slug}/translations`)

		await getSidebar(page)
			.getByRole('button', { name: `Prepnúť projekt, aktuálny ${project.name}` })
			.click()
		await page.getByRole('menu').getByRole('menuitem', { name: 'Všetky projekty' }).click()
		await expect(page).toHaveURL('/')
	})

	test('user block shows initials, name and role; its menu has only Môj profil and Odhlásiť sa', async ({ page }) => {
		await page.goto('/profile')
		await expectUserBlock(page, 'Administrátor')

		const menu = await openUserMenu(page)
		await expect(menu.getByText((await getMe(page)).email, { exact: true })).toBeVisible()
		await expect(menu.getByRole('menuitem')).toHaveText(['Môj profil', 'Odhlásiť sa'])
		await expect(menu.getByRole('menuitem', { name: 'Môj profil' })).toHaveAttribute('href', '/profile')
	})

	test('top bar next to the sidebar has the language and theme switchers and the bell, but no user menu', async ({ page }) => {
		await page.goto('/profile')
		const topBar = page.getByRole('banner')
		await expect(topBar.getByRole('combobox', { name: 'Jazyk', exact: true })).toBeVisible()
		await expect(topBar.getByRole('button', { name: 'Prepnúť na tmavý režim' })).toBeVisible()
		await expect(topBar.getByRole('img', { name: 'Notifikácie' })).toHaveCount(0)
		await expect(topBar.getByRole('button', { name: 'Menu používateľa' })).toHaveCount(0)
		await expect(topBar.getByRole('button', { name: 'Otvoriť navigáciu' })).toBeHidden()
	})

	test('the project list has no sidebar; its top bar has the logo and the user menu', async ({ page }) => {
		await page.goto('/')
		const topBar = page.getByRole('banner')
		await expect(page.getByRole('heading', { level: 1, name: 'Projekty' })).toBeVisible()
		await expect(getSidebar(page)).toHaveCount(0)
		await expect(topBar.getByRole('link', { name: 'Locale – domovská stránka' })).toHaveAttribute('href', '/')
		await expect(topBar.getByRole('button', { name: 'Menu používateľa' })).toBeVisible()
		await expect(topBar.getByText('Administrátor', { exact: true })).toBeVisible()
	})
})

test.describe('EDITOR', () => {
	test.use({ storageState: STORAGE_STATE.EDITOR })

	test('outside a project sees only Všetky projekty and the user block with the Člen role', async ({ page }) => {
		await page.goto('/profile')
		const navigation = getMainNavigation(page)
		await expect(navigation.getByRole('link')).toHaveText(['Všetky projekty'])
		await expect(navigation.getByText('Správa')).toHaveCount(0)
		await expectUserBlock(page, 'Editor')

		const menu = await openUserMenu(page)
		await expect(menu.getByRole('menuitem')).toHaveText(['Môj profil', 'Odhlásiť sa'])
	})
})

test.describe('narrow viewport', () => {
	test.use({ storageState: STORAGE_STATE.ADMIN, viewport: { width: 390, height: 844 } })

	test('the burger opens the sidebar, the close button and a link close it', async ({ page }) => {
		await page.goto('/profile')
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
