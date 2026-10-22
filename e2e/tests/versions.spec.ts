import { type APIRequestContext, expect, test } from '@playwright/test'

import { ANONYMOUS } from '../support/auth'
import { listLanguages, newAdminApi } from '../support/languages'
import { getMainNavigation } from '../support/layout'
import { createProject, type ProjectListItem } from '../support/projects'
import { getCellButton, getTranslationRow, insertTranslationKeys, openTranslations, translationsPath } from '../support/translations'
import { createEditor, loginViaApi } from '../support/users'
import {
	createVersion,
	CURRENT_WINDOW,
	dayShift,
	fillVersionForm,
	formatVersionDate,
	getVersionFormDialog,
	getVersionRow,
	getVersionsTable,
	openVersionsPage,
	PAST_WINDOW,
	versionsApi,
	versionsPath,
} from '../support/versions'

test.describe('ADMIN in a project', () => {
	// The tests build on each other inside one test project of this browser.
	test.describe.configure({ mode: 'serial' })

	let api: APIRequestContext
	let project: ProjectListItem

	test.beforeAll(async ({ playwright }) => {
		api = await newAdminApi(playwright.request)
		project = await createProject(api, 'versions', ['sk', 'en'])
	})

	test.afterAll(async () => {
		await api?.dispose()
	})

	test('opens Verzie from the project sidebar, sees the empty state and creates the first version from it', async ({ page }) => {
		await page.goto(`/projects/${project.slug}/settings`)
		const item = getMainNavigation(page).getByRole('list', { name: project.name }).getByRole('link', { name: 'Verzie' })
		await expect(item).toHaveAttribute('href', versionsPath(project.slug))
		await item.click()
		await expect(page).toHaveURL(versionsPath(project.slug))
		await expect(page.getByRole('heading', { level: 1, name: 'Verzie' })).toBeVisible()
		await expect(item).toHaveAttribute('aria-current', 'page')
		await expect(getVersionsTable(page).getByText('Projekt zatiaľ nemá žiadne verzie. Vytvorte prvú alebo ju zadajte pri importe.')).toBeVisible()

		await getVersionsTable(page).getByRole('button', { name: 'Vytvoriť verziu' }).click()
		const dialog = getVersionFormDialog(page, 'create')
		await expect(dialog).toBeVisible()
		await expect(dialog.getByRole('textbox', { name: 'Názov verzie' })).toBeFocused()

		// The end must be after the start: the form says so before any request.
		await fillVersionForm(dialog, { name: 'v2.45', startsAt: CURRENT_WINDOW.startsAt, endsAt: CURRENT_WINDOW.startsAt })
		await dialog.getByRole('button', { name: 'Vytvoriť' }).click()
		await expect(dialog.getByText('Koniec musí byť po začiatku.')).toBeVisible()

		await fillVersionForm(dialog, { endsAt: CURRENT_WINDOW.endsAt })
		const created = page.waitForResponse((response) => response.url().includes(versionsApi(project.id)) && response.request().method() === 'POST')
		await dialog.getByRole('button', { name: 'Vytvoriť' }).click()
		expect((await created).status()).toBe(201)
		await expect(page.getByText('Verzia v2.45 bola vytvorená.')).toBeVisible()
		await expect(dialog).toBeHidden()

		const row = getVersionRow(page, 'v2.45')
		await expect(row).toContainText('Aktuálna')
		await expect(row).toContainText('Prebieha')
		await expect(row.getByRole('button', { name: 'Upraviť verziu v2.45' })).toBeVisible()
		await expect(row.getByRole('button', { name: 'Zamknúť verziu v2.45' })).toBeVisible()
	})

	test('edits the name and the dates, a duplicate name stays at the field', async ({ page }) => {
		await createVersion(api, project.id, { name: 'v2.44', ...PAST_WINDOW })
		await openVersionsPage(page, project.slug)
		await expect(getVersionRow(page, 'v2.44')).toContainText('Uzamknutá')

		await getVersionRow(page, 'v2.45').getByRole('button', { name: 'Upraviť verziu v2.45' }).click()
		const dialog = getVersionFormDialog(page, 'edit')
		await expect(dialog.getByRole('textbox', { name: 'Názov verzie' })).toHaveValue('v2.45')
		await expect(dialog.getByLabel('Začiatok')).toHaveValue(formatVersionDate(CURRENT_WINDOW.startsAt))
		await expect(dialog.getByLabel('Koniec')).toHaveValue(formatVersionDate(CURRENT_WINDOW.endsAt))

		await fillVersionForm(dialog, { name: 'v2.44' })
		await dialog.getByRole('button', { name: 'Uložiť' }).click()
		await expect(dialog.getByText('Verzia s týmto názvom už v projekte existuje.')).toBeVisible()

		await fillVersionForm(dialog, { name: 'v2.45.1', endsAt: dayShift(20) })
		await dialog.getByRole('button', { name: 'Uložiť' }).click()
		await expect(page.getByText('Verzia v2.45.1 bola uložená.')).toBeVisible()
		await expect(dialog).toBeHidden()
		await expect(getVersionRow(page, 'v2.45.1')).toContainText('Aktuálna')
		await expect(getVersionsTable(page).getByText('v2.45', { exact: true })).toHaveCount(0)
	})

	test('locks a running version after a confirmation and unlocks a locked one', async ({ page }) => {
		await openVersionsPage(page, project.slug)

		await getVersionRow(page, 'v2.45.1').getByRole('button', { name: 'Zamknúť verziu v2.45.1' }).click()
		const lockDialog = page.getByRole('dialog', { name: 'Zamknúť verziu' })
		await expect(lockDialog).toContainText('Po zamknutí verzie v2.45.1 môže jej preklady upravovať už len administrátor.')
		await lockDialog.getByRole('button', { name: 'Zamknúť' }).click()
		await expect(page.getByText('Verzia v2.45.1 je uzamknutá.')).toBeVisible()
		await expect(lockDialog).toBeHidden()
		const current = getVersionRow(page, 'v2.45.1')
		await expect(current).toContainText('Uzamknutá')
		await expect(current).toContainText('Zamknutá ručne')
		await expect(current.getByRole('button', { name: 'Odomknúť verziu v2.45.1' })).toBeVisible()

		await getVersionRow(page, 'v2.44').getByRole('button', { name: 'Odomknúť verziu v2.44' }).click()
		const unlockDialog = page.getByRole('dialog', { name: 'Odomknúť verziu' })
		await unlockDialog.getByRole('button', { name: 'Odomknúť' }).click()
		await expect(page.getByText('Verzia v2.44 je odomknutá.')).toBeVisible()
		const past = getVersionRow(page, 'v2.44')
		await expect(past).toContainText('Prebieha')
		await expect(past).toContainText('Odomknutá na dodatočné úpravy')
	})
})

test.describe('EDITOR', () => {
	test.use({ storageState: ANONYMOUS })

	test('sees the versions without buttons and, in a locked version, read-only translations with the reason', async ({ page, playwright, baseURL }) => {
		const editor = await createEditor(playwright.request, baseURL)
		const api = await newAdminApi(playwright.request)
		const locked = await createVersion(api, editor.projectId, { name: 'v1.0', ...PAST_WINDOW })
		await createVersion(api, editor.projectId, { name: 'v1.1', ...CURRENT_WINDOW })
		await insertTranslationKeys(editor.projectId, await listLanguages(api, editor.projectId), [
			{ namespace: 'loc', name: 'nav.home', values: { sk: 'Domov' } },
		])
		await api.dispose()
		await loginViaApi(page, editor)

		await openVersionsPage(page, editor.projectSlug)
		await expect(getVersionRow(page, 'v1.1')).toContainText('Prebieha')
		await expect(page.getByRole('button', { name: 'Vytvoriť verziu' })).toHaveCount(0)
		await expect(page.getByRole('button', { name: /Upraviť verziu|Zamknúť verziu|Odomknúť verziu/ })).toHaveCount(0)

		await page.goto(translationsPath({ slug: editor.projectSlug } as ProjectListItem, `?version=${locked.id}`))
		await expect(page.getByText('Verzia v1.0 je uzamknutá, jej preklady upravuje už len administrátor.')).toBeVisible()
		await expect(page.getByRole('combobox', { name: 'Verzia' })).toHaveValue('v1.0')
		await expect(page.getByText('Filtrom nezodpovedá žiadny kľúč.').first()).toBeVisible()

		// Without the filter the current version counts down and the cells open as usual.
		await openTranslations(page, { slug: editor.projectSlug } as ProjectListItem)
		await expect(page.getByText('Verzia v1.1: ostáva 12 dní do uzamknutia.')).toBeVisible()
		await expect(getCellButton(getTranslationRow(page, 'nav.home'), 'nav.home')).toBeVisible()
	})
})
