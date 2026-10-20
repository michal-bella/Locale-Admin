import { type Page, expect } from '@playwright/test'

import { type ProjectListItem } from './projects'
import { openTranslations } from './translations'

export const getExportDialog = (page: Page) => page.getByRole('dialog', { name: 'Exportovať preklady' })

/** Opens Preklady of `project` and the export modal. */
export const openExportModal = async (page: Page, project: ProjectListItem) => {
	await openTranslations(page, project)
	await page.getByRole('main').getByRole('button', { name: 'Exportovať' }).click()
	await expect(getExportDialog(page)).toBeVisible()
}

/** Clicks Exportovať CSV and returns the saved file name and content. */
export const downloadExport = async (page: Page) => {
	const [download] = await Promise.all([page.waitForEvent('download'), getExportDialog(page).getByRole('button', { name: 'Exportovať CSV' }).click()])
	const stream = await download.createReadStream()
	const chunks: Buffer[] = []
	for await (const chunk of stream) {
		chunks.push(chunk as Buffer)
	}
	return { fileName: download.suggestedFilename(), content: Buffer.concat(chunks).toString('utf8') }
}

/**
 * `import-sample.csv` (sk, en, cs) exported again with every language: sections and keys in byte order, `""` and missing
 * values as `null`, no blank lines.
 */
export const SAMPLE_EXPORT = [
	'Keys; sk ; en ; cs ',
	'--loc--',
	' cart.items; Máte {{count}} položiek; You have {{count}} items; Máte položek',
	' dashboard.welcome; Vitajte späť, {{name}}; Welcome back, {{ name }}; Vítejte zpět, {{name}}',
	' legal.terms; null; Terms; null',
	' nav.home; Domov; Home; Domů',
	' orders.empty.description; Nové objednávky sa zobrazia tu.; null; null',
	' orders.empty.title; Zatiaľ nemáte žiadne objednávky; You have no orders yet; null',
	' promo.banner; Zľava <strong>20 %</strong>; null; Sleva <strong>20 %</strong>',
	'--paths--',
	' Adresa nie je kompletná. Uistite sa; Adresa nie je kompletná.; The address is incomplete.; null',
	' Pokračovať do pokladne; Pokračovať do pokladne; Continue to checkout; Pokračovat do pokladny',
	' Vrátiť sa do obchodu; Vrátiť sa do obchodu; null; Vrátit se do obchodu',
	'',
].join('\n')
