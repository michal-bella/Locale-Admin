// Captures the screenshots of the editor onboarding guide from the local dev app (pnpm dev).
// Usage: node docs/onboarding/editor/_tools/screenshots.mjs <credentials.json> [shot-name ...]
// credentials.json: { "email": "...", "password": "..." } of a demo EDITOR who is a member of
// web-salon-catalog and b2b-admin. Never saves a translation; the only write is the demo description of one key (keyDescription).
import { readFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(new URL('../../../../e2e/package.json', import.meta.url))
const { chromium } = require('@playwright/test')

const BASE = process.env.BASE_URL ?? 'http://localhost:5173'
const OUT = fileURLToPath(new URL('../images/', import.meta.url))
const [credPath, ...only] = process.argv.slice(2)
const cred = JSON.parse(readFileSync(credPath, 'utf8'))
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const newContext = () => browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: 'sk-SK', reducedMotion: 'reduce' })
const ctx = await newContext()
const login = await ctx.request.post(`${BASE}/api/auth/login`, { data: cred, headers: { 'x-requested-with': 'XMLHttpRequest' } })
if (!login.ok()) throw new Error(`login ${login.status()}`)
const page = await ctx.newPage()

async function api(path, method = 'GET', data) {
	const r = await ctx.request.fetch(`${BASE}${path}`, { method, data, headers: { 'x-requested-with': 'XMLHttpRequest' } })
	return r.json().catch(() => null)
}
const setPrefs = (prefs) => api('/api/profile/preferences', 'PATCH', prefs)

async function go(path) {
	await page.goto(BASE + path)
	await page.waitForLoadState('networkidle')
	await page.waitForTimeout(600)
}
const translations = (slug, search = {}) =>
	`/projects/${slug}/translations?${new URLSearchParams(Object.entries(search).map(([k, v]) => [k, typeof v === 'string' ? JSON.stringify(v) : JSON.stringify(v)])).toString()}`

// Screenshot of the area that covers all given locators, with padding, limited to the viewport.
async function region(name, locators, { pad = 16, full = false } = {}) {
	// A tall viewport keeps the sticky filter bar from covering the table header.
	await page.setViewportSize({ width: 1440, height: 2600 })
	await page.evaluate(() => window.scrollTo(0, 0))
	await page.waitForTimeout(300)
	const boxes = []
	for (const l of locators) boxes.push(await l.first().boundingBox())
	const x = Math.max(0, Math.min(...boxes.map((b) => b.x)) - pad)
	const y = Math.max(0, Math.min(...boxes.map((b) => b.y)) - pad)
	const right = Math.min(1440, Math.max(...boxes.map((b) => b.x + b.width)) + pad)
	const bottom = Math.max(...boxes.map((b) => b.y + b.height)) + pad
	await page.screenshot({ path: `${OUT}${name}.png`, clip: { x, y, width: right - x, height: bottom - y }, fullPage: full })
	await page.setViewportSize({ width: 1440, height: 900 })
	console.log('shot', name)
}
async function viewport(name) {
	await page.screenshot({ path: `${OUT}${name}.png` })
	console.log('shot', name)
}
const modal = () => page.getByRole('dialog')
async function openCell(keyText, languageName) {
	await page
		.getByRole('button', { name: new RegExp(`^Preklad kľúča ${keyText}.*, ${languageName}`) })
		.first()
		.click()
	await modal().waitFor()
	await page.waitForTimeout(400)
}
async function closeModal() {
	await page.keyboard.press('Escape')
	await modal().waitFor({ state: 'hidden' })
}

const shots = {
	async login() {
		const anon = await newContext()
		const p = await anon.newPage()
		await p.goto(`${BASE}/login`)
		await p.waitForLoadState('networkidle')
		const box = await p.locator('form').boundingBox()
		await p.screenshot({ path: `${OUT}login.png`, clip: { x: box.x - 48, y: box.y - 140, width: box.width + 96, height: box.height + 188 } })
		await anon.close()
		console.log('shot', 'login')
	},
	async projects() {
		await go('/')
		const last = await page.getByText('web-salon-catalog').boundingBox()
		await page.screenshot({ path: `${OUT}projects.png`, clip: { x: 0, y: 0, width: 1440, height: last.y + 70 } })
		console.log('shot', 'projects')
	},
	async overview() {
		await setPrefs({ translationsView: 'EXTENDED', translationsLayout: 'COLUMNS' })
		await go(translations('web-salon-catalog', { search: 'Book', languages: ['de-AT'] }))
		await viewport('translations-overview')
	},
	async stats() {
		await go(translations('b2b-admin'))
		await region('stats', [page.getByText('Celkom kľúčov'), page.getByText('Zobraziť nepreložené')], { pad: 20 })
		await region('version-banner', [page.getByRole('alert').filter({ hasText: /Verzia v2\.45:/ })], { pad: 4 })
	},
	async controls() {
		await go(translations('b2b-admin'))
		await region('view-and-filters', [
			page.getByRole('radiogroup', { name: 'Zobrazenie' }),
			page.getByRole('switch', { name: 'Len preklady' }),
			page.getByRole('textbox', { name: /Hľadať/ }),
		])
	},
	async table() {
		await go(translations('web-salon-catalog', { search: 'salon', sort: 'KEY', languages: ['de-AT'] }))
		await region('table-extended', [page.getByRole('table').locator('thead'), page.getByRole('table').locator('tbody tr').nth(6)])
	},
	async untranslated() {
		await go(translations('web-salon-catalog', { status: 'UNTRANSLATED', languages: ['de-AT'] }))
		await region('table-untranslated', [page.getByRole('table').locator('thead'), page.getByRole('table').locator('tbody tr').nth(5)])
	},
	async compact() {
		await setPrefs({ translationsView: 'COMPACT', translationsLayout: 'COLUMNS' })
		await go(translations('web-salon-catalog', { search: 'salon', source: 'sk', target: 'de-AT' }))
		await region('view-compact', [page.getByRole('radiogroup', { name: 'Zobrazenie' }), page.getByRole('table').locator('tbody tr').nth(5)])
		await setPrefs({ translationsView: 'EXTENDED', translationsLayout: 'STACKED' })
		await go(translations('web-salon-catalog', { search: 'salon', languages: ['de-AT'] }))
		await region('view-stacked', [page.getByRole('radiogroup', { name: 'Zobrazenie' }), page.getByRole('table').locator('tbody tr').nth(2)])
		await setPrefs({ translationsView: 'EXTENDED', translationsLayout: 'COLUMNS' })
	},
	async editSimple() {
		// region() resizes the viewport to this size; doing it before the hover keeps the tooltip open.
		await page.setViewportSize({ width: 1440, height: 2600 })
		await go(translations('web-salon-catalog', { search: 'Book an appointment at', languages: ['de-AT'] }))
		await openCell('Book an appointment at', 'nemčina')
		await modal()
			.getByRole('img', { name: /^Popis kľúča/ })
			.hover()
		await page.getByRole('tooltip').waitFor()
		await page.waitForTimeout(300)
		await region('edit-modal-variable', [modal(), page.getByRole('tooltip')], { pad: 0 })
		await closeModal()
	},
	async editHtml() {
		await go(translations('web-salon-catalog', { search: 'I agree to the', languages: ['de-AT'] }))
		await openCell('I agree to the', 'nemčina')
		await region('edit-modal-html', [modal()], { pad: 0 })
		await closeModal()
	},
	// Saves a wrong variable in a project with variable protection; the API must reject it with PLACEHOLDER_MISMATCH.
	async validation() {
		for (const [name, replacement] of [
			['edit-modal-validation-renamed', 'Termin im Salon {salon} buchen'],
			['edit-modal-validation-missing', 'Termin im Salon buchen'],
		]) {
			await go(translations('web-salon-catalog', { search: 'Book an appointment at', languages: ['de-AT'] }))
			await openCell('Book an appointment at', 'nemčina')
			await modal().getByRole('textbox').last().click()
			await page.keyboard.press('ControlOrMeta+A')
			await page.keyboard.type(replacement)
			const response = page.waitForResponse((r) => r.request().method() === 'PUT' && r.url().includes('/translations/'))
			await modal().getByRole('button', { name: 'Uložiť' }).click()
			if ((await response).status() !== 400) throw new Error(`${name}: the API saved the wrong value, restore it by hand`)
			await modal().getByRole('alert').waitFor()
			await page.waitForTimeout(300)
			await region(name, [modal()], { pad: 0 })
			await closeModal()
		}
	},
	async warnings() {
		await go(translations('web-salon-catalog', { warnings: true, languages: ['ru'] }))
		await region('warnings', [page.getByText(/kľúčov má premenné/), page.getByRole('table').locator('tbody tr').nth(3)])
	},
	async pluralIcu() {
		await go(translations('web-salon-catalog', { search: 'starCount', languages: ['de-AT'] }))
		await region('plural-icu-table', [page.getByRole('table').locator('thead'), page.getByRole('table').locator('tbody tr').last()])
		await openCell('', 'nemčina')
		await region('plural-icu-modal', [modal()], { pad: 0 })
		await closeModal()
	},
	async pluralKeys() {
		await go(translations('b2b-admin', { search: 'day_pluralized', sort: 'KEY', languages: ['en'] }))
		await region('plural-keys', [page.getByRole('table').locator('thead'), page.getByRole('table').locator('tbody tr').last()])
	},
	async saveNext() {
		await go(translations('web-salon-catalog', { status: 'UNTRANSLATED', languages: ['de-AT'] }))
		await page.locator('button[data-status="UNTRANSLATED"]').first().click()
		await modal().waitFor()
		await page.keyboard.type('Weitere Informationen über ')
		await page.waitForTimeout(300)
		await region('edit-modal-save-next', [modal()], { pad: 0 })
		await closeModal()
	},
	async diff() {
		await go(translations('b2b-admin', { diff: true, sort: 'KEY', languages: ['hu'] }))
		await region('diff-table', [page.getByText(/Verzia v2\.45:/), page.getByRole('table').locator('tbody tr').nth(5)])
		await page.locator('button[data-changed]').first().click()
		await modal().waitFor()
		await modal()
			.getByRole('button', { name: /Zobraziť preklad z/ })
			.click()
		await page.waitForTimeout(500)
		await region('diff-modal', [modal()], { pad: 0 })
		await closeModal()
	},
	async versionSelect() {
		await go(translations('b2b-admin'))
		const select = page.locator('input[value$="(aktuálna)"]')
		await page.setViewportSize({ width: 1440, height: 1400 })
		await select.click()
		await page.waitForTimeout(300)
		await region('version-select', [select, page.getByRole('listbox')])
		await page.keyboard.press('Escape')
	},
	async versions() {
		await go('/projects/b2b-admin/versions')
		await viewport('versions-page')
	},
	async dashboard() {
		await go('/projects/b2b-admin/dashboard')
		await page.waitForTimeout(1200)
		await viewport('dashboard')
	},
	async history() {
		await go('/projects/b2b-admin/history?category=TRANSLATION')
		await viewport('history')
		await page
			.getByRole('button', { name: /^Zobraziť zmenu prekladu/ })
			.first()
			.click()
		await modal().waitFor()
		await page.waitForTimeout(400)
		await region('history-change-modal', [modal()], { pad: 0 })
		await closeModal()
	},
	async exportModal() {
		await go(translations('b2b-admin'))
		await page.getByRole('button', { name: 'Exportovať' }).click()
		await modal().waitFor()
		await page.waitForTimeout(400)
		await region('export-modal', [modal()], { pad: 0 })
		await closeModal()
	},
	async languages() {
		await go('/projects/b2b-admin/languages')
		await viewport('languages-page')
	},
	async members() {
		await go('/projects/b2b-admin/members')
		await viewport('members-page')
	},
	async settings() {
		await go('/projects/b2b-admin/settings')
		await viewport('settings-page')
	},
	async layout() {
		await go('/projects/b2b-admin/translations')
		await region('sidebar', [page.locator('aside').getByRole('link').first(), page.locator('aside').getByRole('link', { name: /Nastavenia/ })], { pad: 16 })
		await page.getByRole('button', { name: /Menu používateľa/ }).click()
		await page.waitForTimeout(300)
		await region('header-menu', [page.getByRole('textbox', { name: 'Jazyk' }).or(page.getByRole('combobox', { name: 'Jazyk' })), page.getByRole('menu')], {
			pad: 12,
		})
		await page.keyboard.press('Escape')
	},
	async keyDescription() {
		const description = 'Tlačidlo na detaile salónu. {salonName} je názov salónu, napríklad Beauty Studio Nitra.'
		await page.setViewportSize({ width: 1440, height: 1400 })
		await go(translations('web-salon-catalog', { search: 'Book an appointment at', languages: ['de-AT'] }))
		await page
			.getByRole('button', { name: /^Upraviť kľúč Book an appointment at/ })
			.first()
			.click()
		await modal().waitFor()
		const field = modal().getByRole('textbox', { name: 'Popis' })
		await field.fill(description)
		await page.waitForTimeout(300)
		await region('edit-key-modal', [modal()], { pad: 0 })
		const save = modal().getByRole('button', { name: 'Uložiť' })
		if (await save.isEnabled()) {
			await save.click()
			await modal().waitFor({ state: 'hidden' })
		} else await closeModal()
		await go(translations('web-salon-catalog', { search: 'Book an appointment at', languages: ['de-AT'] }))
		const info = page.getByRole('img', { name: /^Popis kľúča/ }).first()
		await info.hover()
		await page.getByRole('tooltip').waitFor()
		await page.waitForTimeout(300)
		await region('key-description', [page.getByRole('tooltip'), page.getByRole('table').locator('tbody tr').nth(1).locator('th, td').first()], { pad: 12 })
	},
	async pagination() {
		await go(translations('b2b-admin'))
		await region('pagination', [page.getByText('Kľúčov na stranu'), page.getByRole('navigation', { name: 'Stránkovanie' })], { pad: 12 })
	},
	async sortSelect() {
		await page.setViewportSize({ width: 1440, height: 2600 })
		await go(translations('b2b-admin'))
		const select = page.locator('input[value="Nepreložené najprv"]')
		await select.click()
		await page.waitForTimeout(300)
		await region('sort-select', [select, page.getByRole('listbox')])
		await page.keyboard.press('Escape')
	},
	async cellTooltip() {
		await page.setViewportSize({ width: 1440, height: 2600 })
		await go(translations('web-salon-catalog', { warnings: true, languages: ['ru'] }))
		const cell = page.locator('button[data-warning]').first()
		await cell.hover()
		await page.getByRole('tooltip').waitFor()
		await page.waitForTimeout(300)
		await region('cell-warning-tooltip', [cell, page.getByRole('tooltip'), page.getByRole('table').locator('thead')])
	},
	async lastEditTooltip() {
		await page.setViewportSize({ width: 1440, height: 2600 })
		await go(translations('web-salon-catalog', { search: 'Book an appointment at', languages: ['de-AT'] }))
		await openCell('Book an appointment at', 'nemčina')
		await modal()
			.getByRole('img', { name: /Posledná úprava/ })
			.hover()
		await page.getByRole('tooltip').waitFor()
		await page.waitForTimeout(300)
		await region('last-edit-tooltip', [modal().getByText('Základný jazyk'), page.getByRole('tooltip'), modal().getByRole('textbox').last()])
		await closeModal()
	},
}

for (const [name, fn] of Object.entries(shots)) {
	if (only.length && !only.includes(name)) continue
	try {
		await fn()
	} catch (error) {
		console.error('FAILED', name, error.message.split('\n')[0])
	}
}
await browser.close()
