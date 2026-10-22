import { expect, test } from '@playwright/test'

import { MUTATION_HEADERS } from '../support/api'
import { downloadExport, downloadExportBytes, getExportDialog, openExportModal, SAMPLE_EXPORT } from '../support/exports'
import { importFile, importPreviewApi, importSample, SAMPLE_CSV } from '../support/imports'
import { listLanguages } from '../support/languages'
import { createProject } from '../support/projects'
import { getTranslationsTable, listTranslations, translationApi, translationsPath } from '../support/translations'
import { createVersion, CURRENT_WINDOW, PAST_WINDOW } from '../support/versions'

test('exports every language as translations.csv that imports back without changes', async ({ page, request }) => {
	const project = await createProject(request, 'export-all', ['sk', 'en', 'cs'])
	await importSample(request, project.id, { sk: 'sk', en: 'en', cs: 'cs' })
	await openExportModal(page, project)

	const dialog = getExportDialog(page)
	await expect(dialog.getByRole('radio', { name: /CSV/ })).toBeChecked()
	await expect(dialog.getByRole('radio', { name: /JSON/ })).toBeDisabled()
	for (const language of ['Slovenčina', 'Angličtina', 'Čeština']) {
		await expect(dialog.getByRole('checkbox', { name: language })).toBeChecked()
	}
	await expect(dialog.getByRole('radio', { name: 'Všetky' })).toBeChecked()
	await expect(dialog.getByRole('textbox', { name: /^Názov súboru/ })).toHaveValue('translations')

	const { fileName, content } = await downloadExport(page)

	expect(fileName).toBe('translations.csv')
	expect(content).toBe(SAMPLE_EXPORT)
	await expect(page.getByText('Preklady sa stiahli do súboru translations.csv.')).toBeVisible()
	await expect(dialog).toBeHidden()

	const preview = await request.post(importPreviewApi(project.id), { data: { fileName, content }, headers: MUTATION_HEADERS })
	expect(preview.status()).toBe(200)
	const { keys, changes } = (await preview.json()) as { keys: { new: number }; changes: { new: number; changed: number }[] }
	expect(keys.new).toBe(0)
	expect(changes.map(({ new: created, changed }) => created + changed)).toEqual([0, 0, 0])
})

test('exports the untranslated keys of the checked languages under the chosen name', async ({ page, request }) => {
	const project = await createProject(request, 'export-filter', ['sk', 'en', 'cs'])
	await importSample(request, project.id, { sk: 'sk', en: 'en', cs: 'cs' })
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
	const project = await createProject(request, 'export-unsafe', ['sk', 'en'])
	await importSample(request, project.id, { sk: 'sk', en: 'en', cs: null })
	const en = (await listLanguages(request, project.id)).find((language) => language.tag === 'en')!
	const key = (await listTranslations(request, project.id)).items.find((item) => item.name === 'nav.home')!
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
	const project = await createProject(request, 'export-xlsx', ['sk', 'en'])
	await importSample(request, project.id, { sk: 'sk', en: 'en', cs: null })
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

test('with a version filter exports the project as of that version, or only its work', async ({ page, request }) => {
	const project = await createProject(request, 'export-version', ['sk', 'en'])
	const [sk, en] = await listLanguages(request, project.id)
	const old = await createVersion(request, project.id, { name: 'v2.44', ...PAST_WINDOW })
	const current = await createVersion(request, project.id, { name: 'v2.45', ...CURRENT_WINDOW })
	await importFile(
		request,
		project.id,
		SAMPLE_CSV,
		[
			{ columnIndex: 2, languageId: sk!.id },
			{ columnIndex: 3, languageId: en!.id },
			{ columnIndex: 4, languageId: null },
		],
		old.id,
	)
	const created = await request.post(`/api/projects/${project.id}/keys`, {
		data: { namespace: 'loc', name: 'nav.about', translations: { [sk!.id]: 'O nás' }, versionId: current.id },
		headers: MUTATION_HEADERS,
	})
	expect(created.status()).toBe(201)

	await page.goto(translationsPath(project, `?version=${current.id}`))
	await expect(getTranslationsTable(page)).toHaveAttribute('aria-busy', 'false')
	await page.getByRole('main').getByRole('button', { name: 'Exportovať' }).click()
	const dialog = getExportDialog(page)
	await expect(dialog.getByText('Stav projektu k verzii v2.45')).toBeVisible()

	const asOf = await downloadExport(page)
	expect(asOf.content).toContain(' nav.about; O nás; null')
	expect(asOf.content).toContain(' nav.home; Domov; Home')

	await page.getByRole('main').getByRole('button', { name: 'Exportovať' }).click()
	await dialog.getByRole('checkbox', { name: 'Len zmeny tejto verzie' }).check()
	const onlyWork = await downloadExport(page)
	expect(onlyWork.content).toBe(['Keys; sk ; en ', '--loc--', ' nav.about; O nás; null', ''].join('\n'))
})
