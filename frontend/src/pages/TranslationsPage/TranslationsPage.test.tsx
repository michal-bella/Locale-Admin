import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { beforeAll, describe, expect, it } from 'vite-plus/test'

import { type Language, type ProjectSettings, SUPPORTED_LANGUAGES, type TranslationListItem, translationGroup, type TranslationsResponse } from '@locale/shared'

import http from '@/api/http'
import queryClient from '@/api/queryClient'
import { QUERY_KEYS } from '@/api/queryKeys'
import i18n from '@/lib/i18n'
import { ADMIN_USER, apiError, projectListRoute, signedInAs } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'

const toLanguage = (tag: Language['tag'], index: number, isBase = false): Language => {
	const supported = SUPPORTED_LANGUAGES.find((language) => language.tag === tag)
	if (!supported) {
		throw new Error(`Unknown tag ${tag}`)
	}
	return { id: `00000000-0000-4000-8000-0000000001${String(index).padStart(2, '0')}`, ...supported, isBase, createdAt: '2026-10-17T10:00:00.000Z' }
}

const SLOVAK = toLanguage('sk', 1, true)
const ENGLISH = toLanguage('en', 2)
const CZECH = toLanguage('cs', 3)

const PROJECT: ProjectSettings = {
	id: '00000000-0000-4000-8000-000000000301',
	name: 'Booking Web',
	slug: 'booking-web',
	primaryColor: '#E83E8C',
	protectVariables: true,
	baseLanguageId: SLOVAK.id,
}

const PAGE_PATH = `/projects/${PROJECT.slug}/translations`

const TRANSLATIONS_URL = `/projects/${PROJECT.id}/translations`

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60 * 1000).toISOString()

let keyIndex = 0

const item = (namespace: string, name: string, source: string | null, target: string | null, updatedAt: string | null = null): TranslationListItem => {
	keyIndex += 1
	return {
		keyId: `00000000-0000-4000-8000-0000000009${String(keyIndex).padStart(2, '0')}`,
		namespace,
		name,
		group: translationGroup(namespace, name),
		source: { value: source },
		target: { value: target, status: target === null ? 'UNTRANSLATED' : 'TRANSLATED', updatedAt },
	}
}

const ITEMS = [
	item('loc', 'orders.empty.title', 'Zatiaľ tu nie sú žiadne objednávky', null),
	item('loc', 'orders.empty.description', 'Nové objednávky sa zobrazia tu.', null),
	item('loc', 'dashboard.welcome', 'Vitajte späť, {{name}}', 'Welcome back, {{name}}', minutesAgo(2)),
	item('paths', 'Uložiť zmeny', 'Uložiť zmeny', 'Save changes', minutesAgo(3 * 60)),
]

const response = (overrides: Partial<TranslationsResponse> = {}): TranslationsResponse => ({
	items: ITEMS,
	total: ITEMS.length,
	page: 1,
	pageSize: 50,
	stats: { totalKeys: 248, translated: 221, untranslated: 27 },
	namespaces: ['loc', 'paths'],
	...overrides,
})

type MockResponse = { status: number; data?: unknown }

/** The project route resolves the slug and loads the settings before the page renders. Returns the sent translation requests. */
const mockPage = ({
	languages = [SLOVAK, ENGLISH],
	translations = response(),
}: { languages?: Language[]; translations?: TranslationsResponse | ((config: InternalAxiosRequestConfig) => MockResponse) } = {}) => {
	const requests = signedInAs(ADMIN_USER, {
		...projectListRoute(PROJECT),
		[`GET /projects/${PROJECT.id}/settings`]: { status: 200, data: PROJECT },
		[`GET /projects/${PROJECT.id}/languages`]: { status: 200, data: languages },
		[`GET ${TRANSLATIONS_URL}`]: typeof translations === 'function' ? translations : { status: 200, data: translations },
	})
	return () => requests.filter((request) => request.url === TRANSLATIONS_URL)
}

const lastParams = (requests: () => InternalAxiosRequestConfig[]) => requests().at(-1)?.params as Record<string, unknown>

const getTable = () => screen.getByRole('table', { name: 'Zoznam prekladov' })

const getRow = (key: string) => {
	const row = within(getTable()).getByText(key).closest('tr')
	if (!row) {
		throw new Error(`Row ${key} not found`)
	}
	return row
}

const pickOption = async (label: string, option: string) => {
	fireEvent.click(screen.getByRole('combobox', { name: label }))
	fireEvent.click(await screen.findByRole('option', { name: option }))
}

beforeAll(() => {
	// The global 3 retries with backoff would delay the error state by seconds.
	queryClient.setQueryDefaults(QUERY_KEYS.PROJECTS.DETAIL(PROJECT.id), { retry: false })
})

describe('TranslationsPage', () => {
	it('renders the header, the stats for the target language and the rows', async () => {
		mockPage()
		renderApp(PAGE_PATH)

		expect(await screen.findByText('orders.empty.title')).toBeInTheDocument()
		expect(screen.getByRole('heading', { level: 1, name: 'Preklady' })).toBeInTheDocument()
		expect(screen.getByText('Spravujte texty a preklady vášho projektu na jednom mieste.')).toBeInTheDocument()
		expect(screen.getAllByText('Booking Web').length).toBeGreaterThan(0)
		expect(screen.getByRole('button', { name: 'Importovať' })).toBeDisabled()
		expect(screen.queryByRole('button', { name: 'Exportovať' })).not.toBeInTheDocument()

		expect(screen.getByText('248')).toBeInTheDocument()
		expect(screen.getByText('221')).toBeInTheDocument()
		expect(screen.getByText('27')).toBeInTheDocument()
		expect(screen.getByRole('progressbar', { name: 'Preložené: 89 %' })).toBeInTheDocument()
		expect(screen.getByRole('progressbar', { name: 'Chýbajúce: 11 %' })).toBeInTheDocument()
		expect(screen.queryByText('Na kontrolu')).not.toBeInTheDocument()

		const headers = within(getTable())
			.getAllByRole('columnheader')
			.filter((header) => header.getAttribute('scope') !== 'rowgroup')
			.map((header) => header.textContent)
		expect(headers).toEqual(['Kľúč', 'slovenčina', 'English', 'Stav'])

		const welcome = within(getRow('dashboard.welcome'))
		expect(welcome.getByText('loc:dashboard')).toBeInTheDocument()
		expect(welcome.getByText('pred 2 min')).toBeInTheDocument()
		expect(welcome.getByText('Preložené')).toBeInTheDocument()
		expect(within(getRow('orders.empty.title')).getByText('Nepreložené')).toBeInTheDocument()
		expect(within(getRow('orders.empty.title')).getByText('Bez prekladu')).toBeInTheDocument()
	})

	it('asks for the base language → first other language, untranslated first, page 1 of 50 by default', async () => {
		const requests = mockPage({ languages: [SLOVAK, CZECH, ENGLISH] })
		renderApp(PAGE_PATH)

		await screen.findByText('orders.empty.title')
		expect(lastParams(requests)).toEqual({
			sourceLanguageId: SLOVAK.id,
			targetLanguageId: CZECH.id,
			sort: 'UNTRANSLATED_FIRST',
			page: 1,
			pageSize: 50,
		})
		expect(screen.getByRole('combobox', { name: 'Zdrojový jazyk' })).toHaveValue('SK')
		expect(screen.getByRole('combobox', { name: 'Cieľový jazyk' })).toHaveValue('CS')
	})

	it('uses the base language as source and target when the project has only one language', async () => {
		const requests = mockPage({ languages: [SLOVAK] })
		renderApp(PAGE_PATH)

		await screen.findByText('orders.empty.title')
		expect(lastParams(requests)).toMatchObject({ sourceLanguageId: SLOVAK.id, targetLanguageId: SLOVAK.id })
	})

	it('reads the filters from the URL', async () => {
		const requests = mockPage({ languages: [SLOVAK, CZECH, ENGLISH] })
		renderApp(`${PAGE_PATH}?search=welcome&status=TRANSLATED&namespace=loc&sort=KEY&source=en&target=sk&page=2`)

		await screen.findByText('orders.empty.title')
		expect(lastParams(requests)).toEqual({
			sourceLanguageId: ENGLISH.id,
			targetLanguageId: SLOVAK.id,
			search: 'welcome',
			status: 'TRANSLATED',
			namespace: 'loc',
			sort: 'KEY',
			page: 2,
			pageSize: 50,
		})
		expect(screen.getByRole('textbox', { name: 'Hľadať kľúč alebo preklad' })).toHaveValue('welcome')
		expect(screen.getByRole('combobox', { name: 'Stav' })).toHaveValue('Preložené')
		expect(screen.getByRole('combobox', { name: 'Zoradenie' })).toHaveValue('Podľa kľúča')
	})

	it('ignores invalid URL values and keeps the defaults', async () => {
		const requests = mockPage()
		renderApp(`${PAGE_PATH}?status=REVIEW&sort=RANDOM&source=pl&page=0`)

		await screen.findByText('orders.empty.title')
		expect(lastParams(requests)).toEqual({ sourceLanguageId: SLOVAK.id, targetLanguageId: ENGLISH.id, sort: 'UNTRANSLATED_FIRST', page: 1, pageSize: 50 })
	})

	it('writes the search to the URL after typing stops and resets the page', async () => {
		const requests = mockPage()
		const router = renderApp(`${PAGE_PATH}?page=3`)
		await screen.findByText('orders.empty.title')

		fireEvent.change(screen.getByRole('textbox', { name: 'Hľadať kľúč alebo preklad' }), { target: { value: 'obj' } })
		fireEvent.change(screen.getByRole('textbox', { name: 'Hľadať kľúč alebo preklad' }), { target: { value: 'objed ' } })
		expect(router.state.location.search).toEqual({ page: 3 })

		await waitFor(() => expect(router.state.location.search).toEqual({ search: 'objed' }))
		await waitFor(() => expect(lastParams(requests)).toMatchObject({ search: 'objed', page: 1 }))
		expect(requests().some((request) => (request.params as Record<string, unknown>).search === 'obj')).toBe(false)
	})

	it('writes status, namespace, sort and languages to the URL', async () => {
		const requests = mockPage({ languages: [SLOVAK, CZECH, ENGLISH] })
		const router = renderApp(`${PAGE_PATH}?page=2`)
		await screen.findByText('orders.empty.title')

		await pickOption('Stav', 'Nepreložené')
		await waitFor(() => expect(router.state.location.search).toEqual({ status: 'UNTRANSLATED' }))

		await pickOption('Namespace', 'paths')
		await waitFor(() => expect(router.state.location.search).toEqual({ status: 'UNTRANSLATED', namespace: 'paths' }))

		await pickOption('Zoradenie', 'Naposledy upravené')
		await waitFor(() => expect(router.state.location.search).toMatchObject({ sort: 'UPDATED' }))

		fireEvent.click(screen.getByRole('combobox', { name: 'Cieľový jazyk' }))
		fireEvent.click(await screen.findByRole('option', { name: /EN/ }))
		await waitFor(() => expect(router.state.location.search).toMatchObject({ target: 'en' }))

		await waitFor(() =>
			expect(lastParams(requests)).toEqual({
				sourceLanguageId: SLOVAK.id,
				targetLanguageId: ENGLISH.id,
				status: 'UNTRANSLATED',
				namespace: 'paths',
				sort: 'UPDATED',
				page: 1,
				pageSize: 50,
			}),
		)

		await pickOption('Stav', 'Všetky stavy')
		await waitFor(() => expect(router.state.location.search).not.toHaveProperty('status'))
	})

	it('shows the namespace filter only when the project has more than one namespace', async () => {
		mockPage({ translations: response({ namespaces: ['loc'] }) })
		renderApp(PAGE_PATH)

		await screen.findByText('orders.empty.title')
		expect(screen.queryByRole('combobox', { name: 'Namespace' })).not.toBeInTheDocument()
	})

	it('inserts a group header row whenever the group changes', async () => {
		mockPage()
		renderApp(PAGE_PATH)
		await screen.findByText('orders.empty.title')

		const rows = within(getTable()).getAllByRole('row').slice(1)
		const summary = rows.map((row) => (row.hasAttribute('data-group-header') ? `# ${row.textContent}` : row.querySelector('td')?.firstChild?.textContent))
		expect(summary).toEqual([
			'# loc:orders.empty',
			'orders.empty.title',
			'orders.empty.description',
			'# loc:dashboard',
			'dashboard.welcome',
			'# paths',
			'Uložiť zmeny',
		])
	})

	it('starts page 2 with a group header even when its group continues from page 1', async () => {
		mockPage({
			translations: response({
				items: [item('loc', 'orders.empty.footer', 'Pätička', null), item('paths', 'Domov', 'Domov', 'Home')],
				total: 52,
				page: 2,
			}),
		})
		renderApp(`${PAGE_PATH}?page=2`)
		await screen.findByText('orders.empty.footer')

		const [firstRow] = within(getTable()).getAllByRole('row').slice(1)
		expect(firstRow).toHaveAttribute('data-group-header')
		expect(firstRow).toHaveTextContent('loc:orders.empty')
		expect(firstRow?.querySelector('th')).toHaveAttribute('scope', 'rowgroup')
	})

	it('hides group headers when sorted by last update', async () => {
		mockPage()
		renderApp(`${PAGE_PATH}?sort=UPDATED`)
		await screen.findByText('orders.empty.title')

		expect(getTable().querySelector('[data-group-header]')).toBeNull()
	})

	it('goes to the last page instead of showing no results for a page past the end', async () => {
		const requests = mockPage({
			translations: (config) => {
				const { page } = config.params as { page: number }
				return { status: 200, data: response({ total: 60, page, items: page > 2 ? [] : ITEMS }) }
			},
		})
		const router = renderApp(`${PAGE_PATH}?page=99`)

		await waitFor(() => expect(router.state.location.search).toEqual({ page: 2 }))
		expect(await screen.findByText('orders.empty.title')).toBeInTheDocument()
		expect(lastParams(requests)).toMatchObject({ page: 2 })
		expect(screen.queryByText('Filtrom nezodpovedá žiadny kľúč.')).not.toBeInTheDocument()
	})

	it('keeps the namespace filter visible while it is active, even with one namespace', async () => {
		mockPage({ translations: response({ namespaces: ['loc'] }) })
		renderApp(`${PAGE_PATH}?namespace=paths`)
		await screen.findByText('orders.empty.title')

		expect(screen.getByRole('combobox', { name: 'Namespace' })).toBeInTheDocument()
	})

	it('limits the search to 200 characters', async () => {
		mockPage()
		renderApp(PAGE_PATH)
		await screen.findByText('orders.empty.title')

		expect(screen.getByRole('textbox', { name: 'Hľadať kľúč alebo preklad' })).toHaveAttribute('maxLength', '200')
	})

	it('marks untranslated rows for the red background', async () => {
		mockPage()
		renderApp(PAGE_PATH)
		await screen.findByText('orders.empty.title')

		expect(getRow('orders.empty.title')).toHaveAttribute('data-status', 'UNTRANSLATED')
		expect(getRow('dashboard.welcome')).toHaveAttribute('data-status', 'TRANSLATED')
	})

	it('shows {{var}} as chips and HTML as plain text', async () => {
		mockPage({
			translations: response({
				items: [
					item('loc', 'items.count', '{{ count }} položiek', '{{count}} items'),
					item('loc', 'terms.link', 'Súhlasím s <a href="/terms">podmienkami</a>', '<strong>Bold</strong><img src=x onerror=alert(1)>'),
				],
			}),
		})
		renderApp(PAGE_PATH)
		await screen.findByText('items.count')

		const count = within(getRow('items.count'))
		expect(count.getByText('{{ count }}').tagName).toBe('CODE')
		expect(count.getByText('{{count}}').tagName).toBe('CODE')
		expect(count.getByText('položiek', { exact: false })).toBeInTheDocument()

		const terms = getRow('terms.link')
		expect(within(terms).getByText('Súhlasím s <a href="/terms">podmienkami</a>')).toBeInTheDocument()
		expect(within(terms).getByText('<strong>Bold</strong><img src=x onerror=alert(1)>')).toBeInTheDocument()
		expect(terms.querySelector('a, strong, img')).toBeNull()
	})

	it('shows skeletons while the translations load', async () => {
		mockPage()
		const original = http.defaults.adapter as AxiosAdapter
		http.defaults.adapter = (config) => (config.url === TRANSLATIONS_URL ? new Promise(() => undefined) : original(config))
		renderApp(PAGE_PATH)

		await screen.findByRole('combobox', { name: 'Cieľový jazyk' })
		expect(getTable()).toHaveAttribute('aria-busy', 'true')
	})

	it('shows the empty state with a disabled Importovať for a project without keys', async () => {
		mockPage({ translations: response({ items: [], total: 0, stats: { totalKeys: 0, translated: 0, untranslated: 0 }, namespaces: [] }) })
		renderApp(PAGE_PATH)

		expect(await screen.findByText('Projekt zatiaľ nemá žiadne kľúče. Pridáte ich importom súboru.')).toBeInTheDocument()
		const importButtons = screen.getAllByRole('button', { name: 'Importovať' })
		expect(importButtons).toHaveLength(2)
		importButtons.forEach((button) => expect(button).toBeDisabled())
		expect(screen.queryByText(/Zobrazených/)).not.toBeInTheDocument()
	})

	it('shows the empty state without asking for translations when the project has no languages', async () => {
		const requests = mockPage({ languages: [] })
		renderApp(PAGE_PATH)

		expect(await screen.findByText('Projekt zatiaľ nemá žiadne kľúče. Pridáte ich importom súboru.')).toBeInTheDocument()
		expect(requests()).toHaveLength(0)
	})

	it('shows a text and clears the filters when nothing matches', async () => {
		mockPage({ translations: response({ items: [], total: 0 }) })
		const router = renderApp(`${PAGE_PATH}?search=xyz&status=TRANSLATED&sort=KEY`)

		expect(await screen.findByText('Filtrom nezodpovedá žiadny kľúč.')).toBeInTheDocument()
		fireEvent.click(screen.getByRole('button', { name: 'Zrušiť filtre' }))

		await waitFor(() => expect(router.state.location.search).toEqual({ sort: 'KEY' }))
		expect(screen.getByRole('textbox', { name: 'Hľadať kľúč alebo preklad' })).toHaveValue('')
	})

	it('shows the translated error code and retries', async () => {
		let fail = true
		mockPage({
			translations: () => {
				if (fail) {
					fail = false
					return apiError(500, 'INTERNAL_ERROR')
				}
				return { status: 200, data: response() }
			},
		})
		renderApp(PAGE_PATH)

		expect(await screen.findByText('Preklady sa nepodarilo načítať.')).toBeInTheDocument()
		expect(screen.getByText(i18n.t('errors.INTERNAL_ERROR'))).toBeInTheDocument()
		expect(screen.queryByText('English message that must not be shown')).not.toBeInTheDocument()

		fireEvent.click(screen.getByRole('button', { name: 'Skúsiť znova' }))
		expect(await screen.findByText('orders.empty.title')).toBeInTheDocument()
	})

	it('paginates 50 per page and writes the page to the URL', async () => {
		const requests = mockPage({
			translations: (config) => ({ status: 200, data: response({ total: 120, page: (config.params as { page: number }).page }) }),
		})
		const router = renderApp(PAGE_PATH)

		expect(await screen.findByText('Zobrazených 4 z 120 kľúčov')).toBeInTheDocument()
		const pagination = within(screen.getByRole('navigation', { name: 'Stránkovanie' }))
		expect(pagination.getByRole('button', { name: 'Predošlá' })).toBeDisabled()
		expect(pagination.getByRole('button', { name: 'Strana 1' })).toHaveAttribute('aria-current', 'page')
		expect(pagination.getByRole('button', { name: 'Strana 3' })).toBeInTheDocument()

		fireEvent.click(pagination.getByRole('button', { name: 'Ďalšia' }))

		await waitFor(() => expect(router.state.location.search).toEqual({ page: 2 }))
		await waitFor(() => expect(lastParams(requests)).toMatchObject({ page: 2 }))
		await waitFor(() => expect(pagination.getByRole('button', { name: 'Strana 2' })).toHaveAttribute('aria-current', 'page'))
	})

	it('shows the relative time and texts in English', async () => {
		await i18n.changeLanguage('en')
		mockPage()
		renderApp(PAGE_PATH)

		expect(await screen.findByText('2 min ago')).toBeInTheDocument()
		expect(screen.getByRole('heading', { level: 1, name: 'Translations' })).toBeInTheDocument()
		expect(screen.getByText('Showing 4 of 4 keys')).toBeInTheDocument()
	})
})
