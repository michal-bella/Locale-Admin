import { expect, type Page } from '@playwright/test'

/** The sidebar is an `<aside>` (`complementary` landmark) with the main navigation and the user block. */
export const getSidebar = (page: Page) => page.getByRole('complementary')

export const getMainNavigation = (page: Page) => page.getByRole('navigation', { name: 'Hlavná navigácia' })

/** Opens the `⋯` menu in the user block of the sidebar and returns the menu. */
export const openUserMenu = async (page: Page) => {
	await getSidebar(page).getByRole('button', { name: 'Menu používateľa' }).click()
	const menu = page.getByRole('menu')
	await expect(menu).toBeVisible()
	return menu
}
