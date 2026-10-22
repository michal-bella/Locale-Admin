import { expect, test } from '@playwright/test'

import { MUTATION_HEADERS } from '../support/api'
import { downloadExport, downloadExportBytes, getExportDialog, openExportModal, SAMPLE_EXPORT } from '../support/exports'
import { importFile, importPreviewApi, importSample, SAMPLE_CSV } from '../support/imports'
import { listLanguages } from '../support/languages'
import { getTranslationsTable, listTranslations, translationApi, translationsPath } from '../support/translations'
import { createProjectWithVersion, createVersion, PAST_WINDOW } from '../support/versions'

test('exports every language as translations.csv that imports back without changes', async ({ page, request }) => {
	const project = await createProjectWithVersion(request, 'export-all', ['sk', 'en', 'cs'])
	await importSample(request, project.id, project.version.id, { sk: 'sk', en: 'en', cs: 'cs' })
	await openExportModal(page, project)

	const dialog = getExportDialog(page)
	await expect(dialog.getByRole('radio', { name: /CSV/ })).toBeChecked()
	await expect(dialog.getByRole('radio', { name: /JSON/ })).toBeDisabled()
	for (const language of ['Slovenčina', 'Angličtina', 'Čeština']) {
		await expect(dialog.getByRole('checkbox', { name: language })).toBeChecked()
	}
	await expect(dialog.getByRole('radio', { name: 'Všetky' })).toBeChecked()
	await expect(dialog.getByText('Export verzie v2.45')).toBeVisible()
	await expect(dialog.getByRole('checkbox', { name: 'Len zmeny oproti predchádzajúcej verzii' })).not.toBeChecked()
	await expect(dialog.getByRole('textbox', { name: /^Názov súboru/ })).toHaveValue('translations')

	const { fileName, content } = await downloadExport(page)

	expect(fileName).toBe('translations.csv')
	expect(content).toBe(SAMPLE_EXPORT)
	await expect(page.getByText('Preklady sa stiahli do súboru translations.csv.')).toBeVisible()
	await expect(dialog).toBeHidden()

	const preview = await request.post(importPreviewApi(project.id), { data: { fileName, content, versionId: project.version.id }, headers: MUTATION_HEADERS })
	expect(preview.status()).toBe(200)
	const { keys, changes, removed } = (await preview.json()) as {
		keys: { new: number }
		changes: { new: number; changed: number }[]
		removed: { total: number }
	}
	expect(keys.new).toBe(0)
	expect(removed.total).toBe(0)
	expect(changes.map(({ new: created, changed }) => created + changed)).toEqual([0, 0, 0])
})

test('exports the untranslated keys of the checked languages under the chosen name', async ({ page, request }) => {
	const project = await createProjectWithVersion(request, 'export-filter', ['sk', 'en', 'cs'])
	await importSample(request, project.id, project.version.id, { sk: 'sk', en: 'en', cs: 'cs' })
	await openExportModal(page, project)
	const dialog = getExportDialog(page)

	await dialog.getByRole('checkbox', { name: 'Čeština' }).click()
	await dialog.getByText('Nepreložené', { exact: true }).click()
	await dialog.getByRole('textbox', { name: /^Názov súboru/ }).fill('notino-b2b')
	const { fileName, content } = await downloadExport(page)

	expect(fileName).toBe('notino-b2b.csv')
	expect(content).toBe(
		[
			'Keys; sk ; en ',
			'--loc--',
			' legal.terms; null; Terms',
			' orders.empty.description; Nové objednávky sa zobrazia tu.; null',
			' promo.banner; Zľava <strong>20 %</strong>; null',
			'--paths--',
			' Vrátiť sa do obchodu; Vrátiť sa do obchodu; null',
			'',
		].join('\n'),
	)
})

test('lists a value that would break the CSV and downloads nothing', async ({ page, request }) => {
	const project = await createProjectWithVersion(request, 'export-unsafe', ['sk', 'en'])
	await importSample(request, project.id, project.version.id, { sk: 'sk', en: 'en', cs: null })
	const en = (await listLanguages(request, project.id)).find((language) => language.tag === 'en')!
	const key = (await listTranslations(request, project.id, project.version.id)).items.find((item) => item.name === 'nav.home')!
	const saved = await request.put(translationApi(project.id, key.keyId, en.id), { data: { value: 'Home&nbsp;page' }, headers: MUTATION_HEADERS })
	expect(saved.status()).toBe(200)
	let downloaded = false
	page.on('download', () => {
		downloaded = true
	})
	await openExportModal(page, project)

	await getExportDialog(page).getByRole('button', { name: 'Exportovať CSV' }).click()

	const alert = getExportDialog(page).getByRole('alert')
	await expect(alert).toContainText('Niektoré preklady obsahujú znaky, ktoré by rozbili CSV súbor.')
	await expect(alert.getByRole('listitem')).toHaveText(['„loc / nav.home“: preklad angličtina obsahuje bodkočiarku (;).'])
	expect(downloaded).toBe(false)
})

test('exports XLSX as translations.xlsx', async ({ page, request }) => {
	const project = await createProjectWithVersion(request, 'export-xlsx', ['sk', 'en'])
	await importSample(request, project.id, project.version.id, { sk: 'sk', en: 'en', cs: null })
	await openExportModal(page, project)
	const dialog = getExportDialog(page)

	await dialog.getByRole('radio', { name: /XLSX/ }).click()
	await expect(dialog.getByRole('radio', { name: /XLSX/ })).toBeChecked()
	const { fileName, bytes } = await downloadExportBytes(page, 'XLSX')

	expect(fileName).toBe('translations.xlsx')
	// An XLSX is a zip archive; the content itself is checked by the backend integration tests.
	expect(bytes.subarray(0, 2).toString('latin1')).toBe('PK')
	expect(bytes.length).toBeGreaterThan(1000)
	await expect(page.getByText('Preklady sa stiahli do súboru translations.xlsx.')).toBeVisible()
})

test('exports the whole file of the shown version, or only the keys added or changed against the previous version', async ({ page, request }) => {
	const project = await createProjectWithVersion(request, 'export-version', ['sk', 'en'])
	const [sk, en] = await listLanguages(request, project.id)
	const old = await createVersion(request, project.id, { name: 'v2.44', ...PAST_WINDOW })
	const columns = [
		{ columnIndex: 2, languageId: sk!.id },
		{ columnIndex: 3, languageId: en!.id },
		{ columnIndex: 4, languageId: null },
	]
	await importFile(request, project.id, old.id, SAMPLE_CSV, columns)
	// The same file into the current version copies v2.44; one key by hand is its only difference.
	expect(await importFile(request, project.id, project.version.id, SAMPLE_CSV, columns)).toMatchObject({ keysCreated: 0, keysCopied: 10, keysRemoved: 0 })
	const created = await request.post(`/api/projects/${project.id}/keys`, {
		data: { namespace: 'loc', name: 'nav.about', translations: { [sk!.id]: 'O nás' }, versionId: project.version.id },
		headers: MUTATION_HEADERS,
	})
	expect(created.status()).toBe(201)

	await page.goto(translationsPath(project, `?version=${project.version.id}`))
	await expect(getTranslationsTable(page)).toHaveAttribute('aria-busy', 'false')
	await page.getByRole('main').getByRole('button', { name: 'Exportovať' }).click()
	const dialog = getExportDialog(page)
	await expect(dialog.getByText('Export verzie v2.45')).toBeVisible()

	const whole = await downloadExport(page)
	expect(whole.content).toContain(' nav.about; O nás; null')
	expect(whole.content).toContain(' nav.home; Domov; Home')

	await page.getByRole('main').getByRole('button', { name: 'Exportovať' }).click()
	await dialog.getByRole('checkbox', { name: 'Len zmeny oproti predchádzajúcej verzii' }).check()
	const changes = await downloadExport(page)
	expect(changes.content).toBe(['Keys; sk ; en ', '--loc--', ' nav.about; O nás; null', ''].join('\n'))

	// The old version is exported as it was: without the new key.
	await page.goto(translationsPath(project, `?version=${old.id}`))
	await expect(getTranslationsTable(page)).toHaveAttribute('aria-busy', 'false')
	await page.getByRole('main').getByRole('button', { name: 'Exportovať' }).click()
	await expect(dialog.getByText('Export verzie v2.44')).toBeVisible()
	const previous = await downloadExport(page)
	expect(previous.content).not.toContain('nav.about')
	expect(previous.content).toContain(' nav.home; Domov; Home')
})
