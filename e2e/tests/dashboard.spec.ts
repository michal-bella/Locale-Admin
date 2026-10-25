import { type APIRequest, type APIRequestContext, expect, type Page, test } from '@playwright/test'

import { STORAGE_STATE } from '../support/auth'
import { newAdminApi } from '../support/languages'
import { getMainNavigation } from '../support/layout'
import { type ProjectListItem } from '../support/projects'
import {
	createProjectWithKeys,
	getTranslationField,
	getTranslationRows,
	getTranslationsTable,
	openEditTranslationModal,
	openTranslations,
	saveTranslation,
} from '../support/translations'
import { addMember } from '../support/users'
import { createVersion, PAST_WINDOW } from '../support/versions'

const TIME_ZONE = 'Europe/Bratislava'

test.use({ timezoneId: TIME_ZONE })

/**
 * sk (base), en, cs and 4 keys inserted in the DB into the current version `v2.45` (no activity events): only `nav.home` has every language,
 * so 1 of 4 keys (25 %) is translated; sk 4 of 4, en 2 of 4, cs 1 of 4. The ADMIN who creates the project is its only member.
 */
const KEYS = [
	{ namespace: 'loc', name: 'nav.home', values: { sk: 'Domov', en: 'Home', cs: 'Domů' } },
	{ namespace: 'loc', name: 'nav.orders', values: { sk: 'Objednávky', en: 'Orders' } },
	{ namespace: 'loc', name: 'nav.profile', values: { sk: 'Profil' } },
	{ namespace: 'loc', name: 'nav.logout', values: { sk: 'Odhlásiť', en: null } },
]

const seedProject = (api: APIRequestContext) => createProjectWithKeys(api, 'dashboard', KEYS, ['sk', 'en', 'cs'])

/** Seeds a project as the ADMIN and returns it with the ADMIN API context; the caller disposes the context. */
const withSeededProject = async (request: APIRequest) => {
	const api = await newAdminApi(request)
	try {
		return { project: await seedProject(api), api }
	} catch (error) {
		await api.dispose()
		throw error
	}
}

const dashboardPath = (project: ProjectListItem) => `/projects/${project.slug}/dashboard`

const getStats = (page: Page) => page.getByRole('region', { name: 'Štatistiky projektu' })

/** The number under the label of a stat card on Prehľad, without the share next to it (the label sits in its own row). */
const getStatValue = (page: Page, label: string) =>
	getStats(page)
		.locator('p')
		.filter({ hasText: new RegExp(`^${label}$`) })
		.locator('xpath=../following-sibling::*[1]/*[1]')

const getLanguageRows = (page: Page) => page.getByRole('list', { name: 'Stav jazykov' }).getByRole('listitem')

const getDailySection = (page: Page) => page.getByRole('region', { name: 'Denná aktivita' })

/** Visually hidden table of the chart for screen readers: a row per day, oldest first. */
const getDailyRows = (page: Page) => page.getByRole('table', { name: 'Denná aktivita' }).locator('tbody tr')

/** Slovak plural of „zmena“ as in `dashboardPage.daily.changes`. */
const changesText = (count: number) => `${count} ${count === 1 ? 'zmena' : count >= 2 && count <= 4 ? 'zmeny' : 'zmien'}`

const openDashboard = async (page: Page, project: ProjectListItem) => {
	await page.goto(dashboardPath(project))
	await expect(getStats(page)).toHaveAttribute('aria-busy', 'false')
}

type DailyActivity = { days: { date: string; changes: number }[] }

const getDaily = async (api: APIRequestContext, projectId: string, range: '7d' | '30d' | '90d') => {
	const path = `/api/projects/${projectId}/activity/daily`
	const response = await api.get(path, { params: { range, timeZone: TIME_ZONE } })
	expect(response.status(), `GET ${path}`).toBe(200)
	return (await response.json()) as DailyActivity
}

const total = ({ days }: DailyActivity) => days.reduce((sum, day) => sum + day.changes, 0)

const searchOf = (page: Page) => new URL(page.url()).searchParams

test.describe('ADMIN', () => {
	test.use({ storageState: STORAGE_STATE.ADMIN })

	test('Prehľad is the first sidebar item, the project still opens on Preklady', async ({ page, playwright }) => {
		const { project, api } = await withSeededProject(playwright.request)
		await api.dispose()

		await page.goto(`/projects/${project.slug}`)
		await expect(page).toHaveURL(`/projects/${project.slug}/translations`)
		const section = getMainNavigation(page).getByRole('list', { name: project.name })
		await expect(section.getByRole('link')).toHaveText(['Prehľad', 'Preklady', 'Verzie', 'História', 'Jazyky', 'Členovia', 'Nastavenia'])

		const dashboard = section.getByRole('link', { name: 'Prehľad' })
		await dashboard.click()
		await expect(page).toHaveURL(dashboardPath(project))
		await expect(dashboard).toHaveAttribute('aria-current', 'page')
		await expect(page.getByRole('heading', { level: 1, name: project.name })).toBeVisible()
	})

	test('shows the header with the version select, the four cards of the current version, Stav jazykov and no Importovať or Exportovať', async ({
		page,
		playwright,
	}) => {
		const { project, api } = await withSeededProject(playwright.request)
		// An older, empty version: the select switches the cards to it.
		await createVersion(api, project.id, { name: 'v2.44', ...PAST_WINDOW })
		await api.dispose()

		await openDashboard(page, project)
		const main = page.getByRole('main')
		await expect(main.getByText('Prehľad projektu', { exact: true })).toBeVisible()
		await expect(page.getByRole('heading', { level: 1, name: project.name })).toBeVisible()
		await expect(main.getByText('Aktuálny stav prekladov, jazykov a posledných zmien.', { exact: true })).toBeVisible()
		await expect(main.getByRole('button', { name: /Importovať|Exportovať/ })).toHaveCount(0)
		await expect(main.getByRole('link', { name: /Importovať|Exportovať/ })).toHaveCount(0)
		await expect(main.getByRole('combobox', { name: 'Verzia' })).toHaveValue('v2.45 (aktuálna)')

		await expect(getStatValue(page, 'Kľúče')).toHaveText('4')
		await expect(getStatValue(page, 'Preložené')).toHaveText(/^25\s%$/)
		await expect(getStatValue(page, 'Jazyky')).toHaveText('3')
		await expect(getStatValue(page, 'Členovia')).toHaveText('0')
		for (const hint of ['+4 za 30 dní', '1 z 4 kľúčov', '1 zdrojový', '0 správcov']) {
			await expect(getStats(page).getByText(hint, { exact: true })).toBeVisible()
		}

		const rows = getLanguageRows(page)
		await expect(rows).toHaveCount(3)
		await expect(rows.nth(0)).toContainText('Slovenčina')
		await expect(rows.nth(0)).toContainText('Zdrojový jazyk')
		await expect(rows.nth(0).getByRole('link')).toHaveCount(0)
		await expect(rows.nth(1)).toContainText('Angličtina')
		await expect(rows.nth(1)).toContainText('2 z 4 preložených')
		await expect(rows.nth(1).getByRole('link')).toHaveAccessibleName(/^Angličtina: zobraziť nepreložené kľúče, 50\s%$/)
		await expect(rows.nth(2)).toContainText('Čeština')
		await expect(rows.nth(2)).toContainText('1 z 4 preložených')

		await main.getByRole('combobox', { name: 'Verzia' }).click()
		await page.getByRole('option', { name: 'v2.44', exact: true }).click()
		await expect(main.getByRole('combobox', { name: 'Verzia' })).toHaveValue('v2.44')
		await expect(getStats(page)).toHaveAttribute('aria-busy', 'false')
		await expect(getStatValue(page, 'Kľúče')).toHaveText('0')
		await expect(getStatValue(page, 'Jazyky')).toHaveText('3')
		await main.getByRole('combobox', { name: 'Verzia' }).click()
		await page.getByRole('option', { name: 'v2.45 (aktuálna)', exact: true }).click()
		await expect(getStatValue(page, 'Kľúče')).toHaveText('4')

		await main.getByRole('link', { name: 'Otvoriť preklady' }).click()
		await expect(page).toHaveURL(`/projects/${project.slug}/translations`)
		await expect(getTranslationsTable(page)).toHaveAttribute('aria-busy', 'false')
	})

	test('a translation edited on Preklady shows in Posledná aktivita and in today’s count', async ({ page, playwright }) => {
		const { project, api } = await withSeededProject(playwright.request)
		try {
			const before = await getDaily(api, project.id, '30d')

			await openTranslations(page, project)
			await openEditTranslationModal(page, 'nav.logout')
			await getTranslationField(page, 'nav.logout').fill('Log out')
			expect((await saveTranslation(page)).status()).toBe(200)

			await getMainNavigation(page).getByRole('link', { name: 'Prehľad' }).click()
			await expect(page).toHaveURL(dashboardPath(project))

			const today = page.getByRole('list', { name: 'Dnes' })
			await expect(today.getByRole('listitem').first()).toContainText('úprava prekladu nav.logout (angličtina)')
			await expect(today.getByRole('listitem').first()).toContainText('· v2.45')

			await expect(getDailySection(page).getByText(`Za posledných 30 dní: ${changesText(total(before) + 1)}`, { exact: true })).toBeVisible()
			await expect(getDailyRows(page)).toHaveCount(30)
			await expect(getDailyRows(page).last().locator('td')).toHaveText(String(before.days.at(-1)!.changes + 1))
		} finally {
			await api.dispose()
		}
	})

	test('a language row and Zobraziť nepreložené open Preklady with the untranslated filter', async ({ page, playwright }) => {
		const { project, api } = await withSeededProject(playwright.request)
		await api.dispose()

		await openDashboard(page, project)
		await getLanguageRows(page).nth(1).getByRole('link').click()
		await expect(page).toHaveURL(new RegExp(`/projects/${project.slug}/translations\\?`))
		expect(searchOf(page).get('target')).toBe('en')
		expect(JSON.parse(searchOf(page).get('languages')!)).toEqual(['en'])
		expect(searchOf(page).get('status')).toBe('UNTRANSLATED')
		await expect(getTranslationsTable(page)).toHaveAttribute('aria-busy', 'false')
		await expect(getTranslationRows(page).first()).toBeVisible()

		await openDashboard(page, project)
		await getStats(page).getByRole('link', { name: 'Zobraziť nepreložené' }).click()
		await expect(page).toHaveURL(`/projects/${project.slug}/translations?status=UNTRANSLATED`)
		await expect(getTranslationsTable(page)).toHaveAttribute('aria-busy', 'false')
	})

	test('the 7 / 30 / 90 dní switch changes the period of the summary', async ({ page, playwright }) => {
		const { project, api } = await withSeededProject(playwright.request)
		try {
			await openDashboard(page, project)
			const section = getDailySection(page)
			const range = section.getByRole('radiogroup', { name: 'Obdobie' })
			await expect(range.getByRole('radio', { name: '30 dní' })).toBeChecked()

			for (const [label, days] of [
				['7 dní', 7],
				['90 dní', 90],
				['30 dní', 30],
			] as const) {
				const daily = await getDaily(api, project.id, `${days}d`)
				// The visible label, not the hidden radio: WebKit does not click the input.
				await range.getByText(label, { exact: true }).click()
				await expect(range.getByRole('radio', { name: label })).toBeChecked()
				await expect(section.getByText(`Za posledných ${days} dní: ${changesText(total(daily))}`, { exact: true })).toBeVisible()
				await expect(getDailyRows(page)).toHaveCount(days)
			}
		} finally {
			await api.dispose()
		}
	})
})

test.describe('EDITOR', () => {
	test.use({ storageState: STORAGE_STATE.EDITOR })

	test('a member sees Prehľad of their project', async ({ page, playwright }) => {
		const { project, api } = await withSeededProject(playwright.request)
		try {
			const me = await page.request.get('/api/auth/me')
			expect(me.status(), 'GET /api/auth/me').toBe(200)
			await addMember(api, project.id, ((await me.json()) as { id: string }).id)
		} finally {
			await api.dispose()
		}

		await openDashboard(page, project)
		await expect(page.getByRole('heading', { level: 1, name: project.name })).toBeVisible()
		await expect(getStatValue(page, 'Kľúče')).toHaveText('4')
		await expect(getStatValue(page, 'Členovia')).toHaveText('1')
		await expect(getStats(page).getByText('0 správcov', { exact: true })).toBeVisible()
		await expect(getLanguageRows(page)).toHaveCount(3)
		await expect(page.getByRole('list', { name: 'Dnes' }).getByRole('listitem').first()).toContainText('pridanie člena')
		await expect(getDailySection(page).getByText(/^Za posledných 30 dní: /)).toBeVisible()
	})
})
