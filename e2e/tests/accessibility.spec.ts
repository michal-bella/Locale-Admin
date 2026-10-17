import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test, type TestInfo } from '@playwright/test'

import { ANONYMOUS } from '../support/auth'

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const COLOR_SCHEMES = ['light', 'dark'] as const
const COLOR_CONTRAST = 'color-contrast'

type Screen = { name: string; path: string; ready: (page: Page) => Promise<void>; anonymous?: boolean }

const SCREENS: Screen[] = [
	{
		name: 'login',
		path: '/login',
		anonymous: true,
		ready: (page) => expect(page.getByRole('heading', { level: 1, name: 'Vitajte späť' })).toBeVisible(),
	},
	{
		name: 'users',
		path: '/admin/users',
		ready: (page) => expect(page.getByRole('table', { name: 'Zoznam používateľov' })).toHaveAttribute('aria-busy', 'false'),
	},
	{
		name: 'languages',
		path: '/languages',
		ready: (page) => expect(page.getByRole('table', { name: 'Zoznam jazykov' })).toHaveAttribute('aria-busy', 'false'),
	},
	{
		name: 'profile',
		path: '/profile',
		ready: (page) => expect(page.getByRole('heading', { level: 1, name: 'Môj profil' })).toBeVisible(),
	},
]

const openScreen = async (page: Page, screen: Screen, colorScheme: (typeof COLOR_SCHEMES)[number]) => {
	// Set per page, never through the shared storageState, so other tests keep the light default.
	await page.addInitScript((value) => localStorage.setItem('mantine-color-scheme-value', value), colorScheme)
	await page.goto(screen.path)
	await screen.ready(page)
	await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', colorScheme)
}

const expectNoViolations = async (axe: AxeBuilder, testInfo: TestInfo) => {
	const { violations } = await axe.analyze()
	await testInfo.attach('axe-violations', { body: JSON.stringify(violations, null, 2), contentType: 'application/json' })
	expect(violations.map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map(({ target }) => target.join(' ')) }))).toEqual([])
}

for (const screen of SCREENS) {
	test.describe(`${screen.name} page`, () => {
		if (screen.anonymous) {
			test.use({ storageState: ANONYMOUS })
		}

		for (const colorScheme of COLOR_SCHEMES) {
			test(`has no WCAG 2.2 AA violations in ${colorScheme} scheme`, async ({ page }, testInfo) => {
				await openScreen(page, screen, colorScheme)
				await expectNoViolations(new AxeBuilder({ page }).withTags(WCAG_TAGS).disableRules([COLOR_CONTRAST]), testInfo)
			})

			// TODO: enable once the brand button, dimmed text and eyebrow tokens meet AA contrast (design decision, see docs/testing.md).
			test.fixme(`has AA text contrast in ${colorScheme} scheme`, async ({ page }, testInfo) => {
				await openScreen(page, screen, colorScheme)
				await expectNoViolations(new AxeBuilder({ page }).withRules([COLOR_CONTRAST]), testInfo)
			})
		}
	})
}
