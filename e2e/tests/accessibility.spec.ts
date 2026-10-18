import AxeBuilder from '@axe-core/playwright'
import { type APIRequest, expect, type Page, test, type TestInfo } from '@playwright/test'

import { ANONYMOUS } from '../support/auth'
import { newAdminApi } from '../support/languages'
import { createProject } from '../support/projects'

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const COLOR_SCHEMES = ['light', 'dark'] as const
const COLOR_CONTRAST = 'color-contrast'

/** `path` is a function for pages of a project: it creates a test project as the ADMIN and returns its URL. */
type Screen = { name: string; path: string | ((request: APIRequest) => Promise<string>); ready: (page: Page) => Promise<void>; anonymous?: boolean }

const inNewProject = (page: 'settings' | 'languages' | 'members') => async (request: APIRequest) => {
	const api = await newAdminApi(request)
	try {
		return `/projects/${(await createProject(api, 'a11y')).id}/${page}`
	} finally {
		await api.dispose()
	}
}

const SCREENS: Screen[] = [
	{
		name: 'login',
		path: '/login',
		anonymous: true,
		ready: (page) => expect(page.getByRole('heading', { level: 1, name: 'Vitajte späť' })).toBeVisible(),
	},
	{
		name: 'projects',
		path: '/',
		ready: (page) => expect(page.getByRole('list', { name: 'Zoznam projektov' })).toBeVisible(),
	},
	{
		name: 'users',
		path: '/admin/users',
		ready: (page) => expect(page.getByRole('table', { name: 'Zoznam administrátorov' })).toHaveAttribute('aria-busy', 'false'),
	},
	{
		name: 'project languages',
		path: inNewProject('languages'),
		ready: (page) => expect(page.getByRole('table', { name: 'Zoznam jazykov' })).toHaveAttribute('aria-busy', 'false'),
	},
	{
		name: 'profile',
		path: '/profile',
		ready: (page) => expect(page.getByRole('heading', { level: 1, name: 'Môj profil' })).toBeVisible(),
	},
	{
		name: 'project settings',
		path: inNewProject('settings'),
		ready: (page) => expect(page.getByRole('button', { name: 'Uložiť zmeny' })).toBeVisible(),
	},
	{
		name: 'members',
		path: inNewProject('members'),
		ready: (page) => expect(page.getByRole('table', { name: 'Zoznam členov' })).toHaveAttribute('aria-busy', 'false'),
	},
]

const openScreen = async (page: Page, request: APIRequest, screen: Screen, colorScheme: (typeof COLOR_SCHEMES)[number]) => {
	// Set per page, never through the shared storageState, so other tests keep the light default.
	await page.addInitScript((value) => localStorage.setItem('mantine-color-scheme-value', value), colorScheme)
	await page.goto(typeof screen.path === 'string' ? screen.path : await screen.path(request))
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
			test(`has no WCAG 2.2 AA violations in ${colorScheme} scheme`, async ({ page, playwright }, testInfo) => {
				await openScreen(page, playwright.request, screen, colorScheme)
				await expectNoViolations(new AxeBuilder({ page }).withTags(WCAG_TAGS).disableRules([COLOR_CONTRAST]), testInfo)
			})

			// TODO: enable once the brand button, dimmed text and eyebrow tokens meet AA contrast (design decision, see docs/testing.md).
			test.fixme(`has AA text contrast in ${colorScheme} scheme`, async ({ page, playwright }, testInfo) => {
				await openScreen(page, playwright.request, screen, colorScheme)
				await expectNoViolations(new AxeBuilder({ page }).withRules([COLOR_CONTRAST]), testInfo)
			})
		}
	})
}
