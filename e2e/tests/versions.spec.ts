import { type APIRequestContext, expect, test } from '@playwright/test'

import { MUTATION_HEADERS, readApiError } from '../support/api'
import { ANONYMOUS } from '../support/auth'
import { downloadExport, getExportDialog } from '../support/exports'
import {
	continueToReview,
	expectColumnStats,
	getFileInput,
	getImportDialog,
	getRemovedList,
	getSummary,
	getVersionSelect,
	importSample,
	importSuccessMessage,
	NEXT_CSV,
	SAMPLE,
	SAMPLE_CSV,
	submitImport,
} from '../support/imports'
import { type Language, listLanguages, newAdminApi } from '../support/languages'
import { getMainNavigation } from '../support/layout'
import { createProject, type ProjectListItem } from '../support/projects'
import {
	expectKeys,
	getCellButton,
	getDiffSwitch,
	getEditTranslationDialog,
	getNewBadge,
	getStat,
	getTranslationField,
	getTranslationRow,
	getTranslationRows,
	getTranslationsTable,
	insertTranslationKeys,
	listTranslations,
	openEditTranslationModal,
	openTranslations,
	saveTranslation,
	toggleDiff,
	translationApi,
	translationsPath,
} from '../support/translations'
import { createEditor, loginViaApi } from '../support/users'
import {
	createVersion,
	CURRENT_WINDOW,
	dayShift,
	fillVersionForm,
	formatVersionDate,
	getDeleteVersionDialog,
	getVersionFormDialog,
	getVersionRow,
	getVersionsTable,
	listVersions,
	openVersionsPage,
	PAST_WINDOW,
	type ProjectVersion,
	UPCOMING_WINDOW,
	versionsApi,
	versionsPath,
} from '../support/versions'

/** Keys of `import-next.csv` added or changed against `import-sample.csv`: two new keys, two keys with a changed en cell. */
const NEXT_DIFF_KEYS = ['orders.empty.description', 'dashboard.welcome', 'nav.about', 'Kontaktujte nás']

test.describe('ADMIN in a project', () => {
	// The tests build on each other inside one test project of this browser: v2.44 (locked, imported) and v2.45.1 (current).
	test.describe.configure({ mode: 'serial' })

	let api: APIRequestContext
	let project: ProjectListItem
	let languages: Language[]
	let previous: ProjectVersion
	let current: ProjectVersion

	test.beforeAll(async ({ playwright }) => {
		api = await newAdminApi(playwright.request)
		project = await createProject(api, 'versions', ['sk', 'en'])
		languages = await listLanguages(api, project.id)
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
		await expect(getVersionsTable(page).getByRole('columnheader')).toHaveText(['Verzia', 'Začiatok', 'Koniec', 'Kľúče', 'Stav', 'Akcie'])
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

		// A new version is empty until an import; the current version cannot be deleted.
		const row = getVersionRow(page, 'v2.45')
		await expect(row).toContainText('Aktuálna')
		await expect(row).toContainText('Prebieha')
		await expect(row.getByRole('cell').nth(3)).toHaveText('bez importu')
		await expect(row).not.toContainText('Import ')
		await expect(row.getByRole('button', { name: 'Upraviť verziu v2.45' })).toBeVisible()
		await expect(row.getByRole('button', { name: 'Zamknúť verziu v2.45' })).toBeVisible()
		await expect(row.getByRole('button', { name: 'Zmazať verziu v2.45' })).toHaveCount(0)
	})

	test('edits the name and the dates, a duplicate name stays at the field', async ({ page }) => {
		previous = await createVersion(api, project.id, { name: 'v2.44', ...PAST_WINDOW })
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
		current = (await listVersions(api, project.id)).find(({ name }) => name === 'v2.45.1')!
	})

	test('locks a running version after a confirmation and unlocks a locked one', async ({ page }) => {
		await openVersionsPage(page, project.slug)

		await getVersionRow(page, 'v2.45.1').getByRole('button', { name: 'Zamknúť verziu v2.45.1' }).click()
		const lockDialog = page.getByRole('dialog', { name: 'Zamknúť verziu' })
		await expect(lockDialog).toContainText('Po zamknutí verzie v2.45.1 môže jej preklady upravovať už len administrátor.')
		await lockDialog.getByRole('button', { name: 'Zamknúť' }).click()
		await expect(page.getByText('Verzia v2.45.1 je uzamknutá.')).toBeVisible()
		await expect(lockDialog).toBeHidden()
		const locked = getVersionRow(page, 'v2.45.1')
		await expect(locked).toContainText('Uzamknutá')
		await expect(locked).toContainText('Zamknutá ručne')
		await expect(locked.getByRole('button', { name: 'Odomknúť verziu v2.45.1' })).toBeVisible()

		// Back to the automatic lock by the dates, so the current version runs again for the import tests below.
		await locked.getByRole('button', { name: 'Odomknúť verziu v2.45.1' }).click()
		await page.getByRole('dialog', { name: 'Odomknúť verziu' }).getByRole('button', { name: 'Odomknúť' }).click()
		await expect(page.getByText('Verzia v2.45.1 je odomknutá.')).toBeVisible()
		await expect(getVersionRow(page, 'v2.45.1')).toContainText('Prebieha')

		await getVersionRow(page, 'v2.44').getByRole('button', { name: 'Odomknúť verziu v2.44' }).click()
		const unlockDialog = page.getByRole('dialog', { name: 'Odomknúť verziu' })
		await unlockDialog.getByRole('button', { name: 'Odomknúť' }).click()
		await expect(page.getByText('Verzia v2.44 je odomknutá.')).toBeVisible()
		const past = getVersionRow(page, 'v2.44')
		await expect(past).toContainText('Prebieha')
		await expect(past).toContainText('Odomknutá na dodatočné úpravy')
	})

	test('an empty version shows the import prompt; the import copies the previous version and the review says what it takes over', async ({ page }) => {
		// v2.44 gets the sample (sk, en): 10 keys. v2.45.1 stays empty until its own import.
		expect(await importSample(api, project.id, previous.id, { sk: 'sk', en: 'en', cs: null })).toEqual({
			keysCreated: SAMPLE.keys,
			keysCopied: 0,
			keysRemoved: 0,
			translationsCreated: SAMPLE.sk.translations + SAMPLE.en.translations,
			translationsUpdated: 0,
			skippedColumns: 1,
			version: { id: previous.id, name: 'v2.44' },
		})
		await openVersionsPage(page, project.slug)
		await expect(getVersionRow(page, 'v2.44').getByRole('cell').nth(3)).toHaveText('10')
		await expect(getVersionRow(page, 'v2.44')).toContainText(/Import \d{1,2}\. \d{1,2}\. \d{4}/)
		await expect(getVersionRow(page, 'v2.45.1').getByRole('cell').nth(3)).toHaveText('bez importu')

		await page.goto(translationsPath(project))
		const empty = page.getByRole('main').getByText('Verzia v2.45.1 zatiaľ nemá import. Importujte do nej preklady.').first()
		await expect(empty).toBeVisible()
		await expect(page.getByRole('combobox', { name: 'Verzia' })).toHaveValue('v2.45.1 (aktuálna)')
		await expect(getTranslationsTable(page)).toHaveCount(0)
		await expect(getDiffSwitch(page)).toHaveCount(0)
		await expect(page.getByRole('button', { name: 'Pridať kľúč' })).toHaveCount(0)
		await expect(page.getByRole('button', { name: 'Vytvoriť verziu' })).toBeVisible()
		await expect(getStat(page, 'Celkom kľúčov')).toHaveText('0')

		// Importovať in the empty state opens the modal on the shown version.
		await page.getByRole('main').getByRole('button', { name: 'Importovať' }).last().click()
		await expect(getImportDialog(page)).toBeVisible()
		await expect(getVersionSelect(page)).toHaveValue('v2.45.1 (aktuálna)')
		await getFileInput(page).setInputFiles(NEXT_CSV)
		await continueToReview(page)
		// Cells are compared with the previous version: en gains `orders.empty.description` and changes `dashboard.welcome`.
		await expectColumnStats(page, 'sk', { translations: 10, untranslated: 0 }, 0, '2 / 0')
		await expectColumnStats(page, 'en', { translations: 9, untranslated: 1 }, 0, '3 / 1')
		await expect(getSummary(page).getByRole('listitem')).toHaveText([
			'2 nové kľúče',
			'1 preklad sa prepíše',
			'5 nových prekladov',
			'Verzia: v2.45.1',
			'Prevzaté z v2.44: 8 kľúčov',
		])
		await expect(getRemovedList(page)).toHaveCount(0)

		const importRequest = submitImport(page, project.id)
		expect((await importRequest).postDataJSON()).toMatchObject({ fileName: 'import-next.csv', versionId: current.id })
		await expect(page.getByText(importSuccessMessage(2, 5, 1, 8))).toBeVisible()
		await expect(getImportDialog(page)).toHaveCount(0)

		// The version now holds exactly the file: 10 keys, the two keys missing from the file were not taken over.
		await expect(getTranslationsTable(page)).toHaveAttribute('aria-busy', 'false')
		await expect(getStat(page, 'Celkom kľúčov')).toHaveText('10')
		await expect(getTranslationRows(page)).toHaveCount(10)
		await expect(getTranslationRow(page, 'nav.about')).toHaveCount(1)
		await expect(getTranslationRow(page, 'legal.terms')).toHaveCount(0)
		await expect(getTranslationRow(page, 'Vrátiť sa do obchodu')).toHaveCount(0)
		const { items } = await listTranslations(api, project.id, previous.id)
		expect(items).toHaveLength(SAMPLE.keys)

		await openVersionsPage(page, project.slug)
		await expect(getVersionRow(page, 'v2.45.1').getByRole('cell').nth(3)).toHaveText('10')
		await expect(getVersionRow(page, 'v2.45.1')).toContainText(/Import \d{1,2}\. \d{1,2}\. \d{4}/)
	})

	test('the banner sums up the diff, the list marks the changes; Zobraziť len zmeny keeps the added and changed keys with their markers', async ({
		page,
	}) => {
		await openTranslations(page, project)
		await expect(page.getByText('Verzia v2.45.1: ostáva 20 dní do uzamknutia.')).toBeVisible()
		await expect(page.getByText('Oproti v2.44: 2 nové, 2 zmenené, 2 odstránené kľúče.')).toBeVisible()
		await expect(getTranslationRows(page)).toHaveCount(10)
		// The markers show without the filter too; the switch only narrows the list to them.
		await expect(getNewBadge(getTranslationsTable(page))).toHaveCount(2)

		await toggleDiff(page, true)
		await expect(page).toHaveURL(translationsPath(project, '?diff=true'))
		await expect(getTranslationRows(page)).toHaveCount(NEXT_DIFF_KEYS.length)
		const added = getTranslationRow(page, 'nav.about')
		await expect(getNewBadge(added)).toHaveCount(1)
		await expect(added.getByText('Nové', { exact: true })).toBeVisible()
		await expect(getNewBadge(getTranslationRow(page, 'Kontaktujte nás'))).toHaveCount(1)
		const changed = getTranslationRow(page, 'dashboard.welcome')
		await expect(getNewBadge(changed)).toHaveCount(0)
		await expect(getCellButton(changed, 'dashboard.welcome')).toHaveAttribute('data-changed', 'true')
		await expect(getCellButton(changed, 'dashboard.welcome')).toHaveAccessibleName(
			'Preklad kľúča dashboard.welcome, angličtina: Zmenené: Welcome back, {{name}}',
		)
		await expect(getCellButton(changed, 'dashboard.welcome', 'slovenčina')).not.toHaveAttribute('data-changed')
		await expect(getCellButton(getTranslationRow(page, 'orders.empty.description'), 'orders.empty.description')).toHaveAttribute('data-changed', 'true')
		// The stat cards count the whole version; the diff survives a reload and a card click drops it.
		await expect(getStat(page, 'Celkom kľúčov')).toHaveText('10')

		await page.reload()
		await expect(getTranslationsTable(page)).toHaveAttribute('aria-busy', 'false')
		await expect(getDiffSwitch(page)).toBeChecked()
		await expect(getTranslationRows(page)).toHaveCount(NEXT_DIFF_KEYS.length)

		await toggleDiff(page, false)
		await expect(page).toHaveURL(translationsPath(project))
		await expect(getTranslationRows(page)).toHaveCount(10)

		const diff = await listTranslations(api, project.id, current.id, undefined, true)
		expect(diff.items.map(({ name }) => name).sort()).toEqual([...NEXT_DIFF_KEYS].sort())
		const en = languages.find(({ tag }) => tag === 'en')!
		expect(diff.items.find(({ name }) => name === 'nav.about')!.diff).toEqual({ added: true, changedLanguageIds: [] })
		expect(diff.items.find(({ name }) => name === 'dashboard.welcome')!.diff).toEqual({ added: false, changedLanguageIds: [en.id] })
	})

	test('the export is the whole file of the version, or only its changes against the previous version', async ({ page }) => {
		await openTranslations(page, project)
		await page.getByRole('main').getByRole('button', { name: 'Exportovať' }).click()
		const dialog = getExportDialog(page)
		await expect(dialog.getByText('Export verzie v2.45.1')).toBeVisible()
		await expect(dialog.getByRole('checkbox', { name: 'Len zmeny oproti predchádzajúcej verzii' })).not.toBeChecked()

		const whole = await downloadExport(page)
		expect(whole.content).toContain(' nav.about; O nás; About us')
		expect(whole.content).toContain(' nav.home; Domov; Home')
		expect(whole.content).not.toContain('legal.terms')
		expect(whole.content.split('\n').filter((line) => line.startsWith(' '))).toHaveLength(10)

		await page.getByRole('main').getByRole('button', { name: 'Exportovať' }).click()
		await dialog.getByRole('checkbox', { name: 'Len zmeny oproti predchádzajúcej verzii' }).check()
		const changes = await downloadExport(page)
		expect(changes.content).toBe(
			[
				'Keys; sk ; en ',
				'--loc--',
				' dashboard.welcome; Vitajte späť, {{name}}; Welcome back, {{name}}',
				' nav.about; O nás; About us',
				' orders.empty.description; Nové objednávky sa zobrazia tu.; New orders will appear here.',
				'--paths--',
				' Kontaktujte nás; Kontaktujte nás; Contact us',
				'',
			].join('\n'),
		)
	})

	test('a repeated import warns about the keys of the version missing from the file and removes them', async ({ page }) => {
		await openTranslations(page, project)
		await page.getByRole('main').getByRole('button', { name: 'Importovať' }).click()
		await expect(getVersionSelect(page)).toHaveValue('v2.45.1 (aktuálna)')
		await getFileInput(page).setInputFiles(SAMPLE_CSV)
		await continueToReview(page)

		// The sample lacks the two new keys of v2.45.1 and brings back the two keys of v2.44 the first import skipped.
		await expect(getSummary(page).getByRole('listitem')).toHaveText([
			'0 nových kľúčov',
			'1 preklad sa prepíše',
			'0 nových prekladov',
			'1 kľúč bez prekladu v základnom jazyku',
			'1 stĺpec sa preskočí',
			'Verzia: v2.45.1',
			'Prevzaté z v2.44: 2 kľúče',
		])
		await expect(getImportDialog(page).getByText('Import odstráni 2 kľúče verzie, ktoré v súbore nie sú:')).toBeVisible()
		await expect(getRemovedList(page).getByRole('listitem')).toHaveText(['loc:nav.about', 'paths:Kontaktujte nás'])

		await getImportDialog(page).getByRole('button', { name: 'Importovať' }).click()
		await expect(page.getByText(importSuccessMessage(0, 0, 1, 2, 2))).toBeVisible()
		await expect(getImportDialog(page)).toHaveCount(0)

		await expect(getTranslationsTable(page)).toHaveAttribute('aria-busy', 'false')
		await expect(getTranslationRows(page)).toHaveCount(10)
		await expect(getTranslationRow(page, 'nav.about')).toHaveCount(0)
		await expect(getTranslationRow(page, 'Kontaktujte nás')).toHaveCount(0)
		await expect(getTranslationRow(page, 'legal.terms')).toHaveCount(1)
		await expect(getTranslationRow(page, 'Vrátiť sa do obchodu')).toHaveCount(1)
		// `null` in the file never clears a value: the en cell filled by the first import stays, so the diff still counts it.
		await expect(getTranslationRow(page, 'orders.empty.description')).toContainText('New orders will appear here.')
		await expect(page.getByText('Oproti v2.44: 0 nových, 1 zmenený, 0 odstránených kľúčov.')).toBeVisible()
	})

	test('deletes a version that is not current after a confirmation; the current one has no Zmazať', async ({ page }) => {
		await openVersionsPage(page, project.slug)
		await expect(getVersionRow(page, 'v2.45.1').getByRole('button', { name: 'Zmazať verziu v2.45.1' })).toHaveCount(0)
		await getVersionRow(page, 'v2.44').getByRole('button', { name: 'Zmazať verziu v2.44' }).click()
		const dialog = getDeleteVersionDialog(page)
		await expect(dialog).toContainText('Zmazanie verzie v2.44 odstráni aj jej 10 kľúčov s prekladmi. Ostatné verzie sa nemenia.')
		await dialog.getByRole('button', { name: 'Zrušiť' }).click()
		await expect(dialog).toBeHidden()
		await expect(getVersionRow(page, 'v2.44')).toHaveCount(1)

		await getVersionRow(page, 'v2.44').getByRole('button', { name: 'Zmazať verziu v2.44' }).click()
		const deleted = page.waitForResponse(
			(response) => response.url().endsWith(`${versionsApi(project.id)}/${previous.id}`) && response.request().method() === 'DELETE',
		)
		await getDeleteVersionDialog(page).getByRole('button', { name: 'Zmazať' }).click()
		expect((await deleted).status()).toBe(204)
		await expect(page.getByText('Verzia v2.44 bola zmazaná.')).toBeVisible()
		await expect(getDeleteVersionDialog(page)).toBeHidden()
		await expect(getVersionRow(page, 'v2.44')).toHaveCount(0)
		await expect(getVersionRow(page, 'v2.45.1')).toHaveCount(1)
		expect((await listVersions(api, project.id)).map(({ name }) => name)).toEqual(['v2.45.1'])

		const refused = await api.delete(`${versionsApi(project.id)}/${current.id}`, { data: {}, headers: MUTATION_HEADERS })
		expect(refused.status()).toBe(409)
		expect((await readApiError(refused)).code).toBe('PROJECT_VERSION_CURRENT')

		// Without a predecessor the version keeps its copy and is the first one of the project.
		await openTranslations(page, project)
		await expect(getTranslationRows(page)).toHaveCount(10)
		await expect(page.getByText('Prvá verzia projektu.')).toBeVisible()
	})
})

test.describe('EDITOR', () => {
	test.use({ storageState: ANONYMOUS })

	test('sees the versions without buttons and gets read-only translations in a locked version and before the start of one', async ({
		page,
		playwright,
		baseURL,
	}) => {
		const editor = await createEditor(playwright.request, baseURL)
		const api = await newAdminApi(playwright.request)
		const languages = await listLanguages(api, editor.projectId)
		const [sk] = languages
		const locked = await createVersion(api, editor.projectId, { name: 'v1.0', ...PAST_WINDOW })
		const running = await createVersion(api, editor.projectId, { name: 'v1.1', ...CURRENT_WINDOW })
		const upcoming = await createVersion(api, editor.projectId, { name: 'v1.2', ...UPCOMING_WINDOW })
		for (const version of [locked, running, upcoming]) {
			await insertTranslationKeys(editor.projectId, version.id, languages, [{ namespace: 'loc', name: 'nav.home', values: { sk: 'Domov' } }])
		}
		const upcomingKey = (await listTranslations(api, editor.projectId, upcoming.id)).items[0]!.keyId
		await api.dispose()
		await loginViaApi(page, editor)

		await openVersionsPage(page, editor.projectSlug)
		await expect(getVersionsTable(page).getByRole('columnheader')).toHaveText(['Verzia', 'Začiatok', 'Koniec', 'Kľúče', 'Stav', 'Akcie'])
		await expect(getVersionRow(page, 'v1.0').getByRole('link', { name: 'Otvoriť preklady verzie v1.0' })).toBeVisible()
		await expect(getVersionRow(page, 'v1.1')).toContainText('Prebieha')
		await expect(getVersionRow(page, 'v1.2')).toContainText('Pripravuje sa')
		await expect(getVersionRow(page, 'v1.0')).toContainText('Uzamknutá')
		await expect(getVersionRow(page, 'v1.0').getByRole('cell').nth(3)).toHaveText('1')
		await expect(page.getByRole('button', { name: 'Vytvoriť verziu' })).toHaveCount(0)
		await expect(page.getByRole('button', { name: /Upraviť verziu|Zamknúť verziu|Odomknúť verziu|Zmazať verziu/ })).toHaveCount(0)

		const project = { slug: editor.projectSlug } as ProjectListItem
		await openTranslations(page, project, `?version=${locked.id}`)
		await expect(page.getByText('Verzia v1.0 je uzamknutá, jej preklady upravuje už len administrátor.')).toBeVisible()
		await expect(page.getByRole('combobox', { name: 'Verzia' })).toHaveValue('v1.0')
		await expect(page.getByRole('button', { name: 'Zamknúť' })).toHaveCount(0)
		const lockedRow = getTranslationRow(page, 'nav.home')
		await expect(lockedRow).toHaveCount(1)
		await expect(lockedRow.getByRole('button')).toHaveCount(0)
		await expect(lockedRow.locator('[data-readonly]')).toHaveCount(2)
		await lockedRow.getByText('Domov', { exact: true }).click()
		await expect(getEditTranslationDialog(page)).toHaveCount(0)

		await openTranslations(page, project, `?version=${upcoming.id}`)
		await expect(page.getByText('Verzia v1.2 začína o 5 dní.')).toBeVisible()
		await expect(getTranslationRow(page, 'nav.home').getByRole('button')).toHaveCount(0)
		const refused = await page.request.put(translationApi(editor.projectId, upcomingKey, sk!.id), {
			data: { value: 'Home' },
			headers: MUTATION_HEADERS,
		})
		expect(refused.status()).toBe(409)
		expect((await readApiError(refused)).code).toBe('PROJECT_VERSION_LOCKED')

		// The page opens on the current version, which counts down; its cells open and save as usual.
		await openTranslations(page, project)
		await expect(page.getByText('Verzia v1.1: ostáva 12 dní do uzamknutia.')).toBeVisible()
		await expect(page.getByRole('combobox', { name: 'Verzia' })).toHaveValue('v1.1 (aktuálna)')
		await openEditTranslationModal(page, 'nav.home')
		await getTranslationField(page, 'nav.home').fill('Home')
		expect((await saveTranslation(page)).status()).toBe(200)
		await expect(getEditTranslationDialog(page)).toBeHidden()
		await expectKeys(getTranslationRows(page), ['nav.home'])
		// The saved value differs from the previous version, so the cell is marked as changed.
		await expect(getCellButton(getTranslationRow(page, 'nav.home'), 'nav.home')).toHaveAccessibleName('Preklad kľúča nav.home, angličtina: Zmenené: Home')
	})
})
