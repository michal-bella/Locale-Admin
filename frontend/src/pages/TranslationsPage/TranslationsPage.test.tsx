import { notifications } from '@mantine/notifications'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { beforeAll, describe, expect, it, vi } from 'vite-plus/test'

import {
	type AuthUser,
	type Language,
	type ProjectSettings,
	SUPPORTED_LANGUAGES,
	type TranslationCell,
	type TranslationListItem,
	translationGroup,
	type TranslationsResponse,
} from '@locale/shared'

import http from '@/api/http'
import queryClient from '@/api/queryClient'
import { QUERY_KEYS } from '@/api/queryKeys'
import i18n from '@/lib/i18n'
import { ADMIN_USER as EXTENDED_ADMIN, apiError, EDITOR_USER as EXTENDED_EDITOR, type MockRoutes, projectListRoute, signedInAs } from '@/test/mockApi'
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

/** The page tests below cover the Figma compact view; the extended view, the default for a new user, has its own describe at the end. */
const compact = (user: AuthUser): AuthUser => ({ ...user, preferences: { translationsView: 'COMPACT' } })

const ADMIN_USER = compact(EXTENDED_ADMIN)

const EDITOR_USER = compact(EXTENDED_EDITOR)

const TRANSLATIONS_URL = `/projects/${PROJECT.id}/translations`

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60 * 1000).toISOString()

let keyIndex = 0

const cell = (value: string | null, updatedAt: string | null = null): TranslationCell => ({
	value,
	status: value === null ? 'UNTRANSLATED' : 'TRANSLATED',
	updatedAt,
})

/** `source` is the Slovak text, `target` the English one; the row status follows English (the default target). */
const item = (namespace: string, name: string, source: string | null, target: string | null, updatedAt: string | null = null): TranslationListItem => {
	keyIndex += 1
	return {
		keyId: `00000000-0000-4000-8000-0000000009${String(keyIndex).padStart(2, '0')}`,
		namespace,
		name,
		group: translationGroup(namespace, name),
		description: null,
		plural: null,
		status: target === null ? 'UNTRANSLATED' : 'TRANSLATED',
		translations: { [SLOVAK.id]: cell(source), [ENGLISH.id]: cell(target, updatedAt) },
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
	pageSize: 20,
	stats: { totalKeys: 248, translated: 221, untranslated: 27 },
	namespaces: ['loc', 'paths'],
	...overrides,
})

type MockResponse = { status: number; data?: unknown }

/** The project route resolves the slug and loads the settings before the page renders. Returns the sent translation requests. */
const mockPage = ({
	languages = [SLOVAK, ENGLISH],
	translations = response(),
	user = ADMIN_USER,
	routes = {},
}: {
	languages?: Language[]
	translations?: TranslationsResponse | ((config: InternalAxiosRequestConfig) => MockResponse)
	user?: AuthUser
	routes?: MockRoutes
} = {}) => {
	const requests = signedInAs(user, {
		...projectListRoute(PROJECT),
		[`GET /projects/${PROJECT.id}/settings`]: { status: 200, data: PROJECT },
		[`GET /projects/${PROJECT.id}/languages`]: { status: 200, data: languages },
		[`GET ${TRANSLATIONS_URL}`]: typeof translations === 'function' ? translations : { status: 200, data: translations },
		...routes,
	})
	return () => requests.filter((request) => request.url === TRANSLATIONS_URL)
}

const lastParams = (requests: () => InternalAxiosRequestConfig[]) => requests().at(-1)?.params as Record<string, unknown>

const getTable = () => screen.getByRole('table', { name: 'Zoznam prekladov' })

const STATUS = '[role="status"]'

/** The visible text of a table state or the pagination summary; the hidden live region repeats it. */
const findVisibleText = (text: string) => screen.findByText(text, { ignore: STATUS })

const getAnnouncement = (text: string) => screen.getByText(text, { selector: STATUS })

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
		expect(screen.getByRole('button', { name: 'Importovať' })).toBeEnabled()
		expect(screen.queryByRole('button', { name: 'Exportovať' })).not.toBeInTheDocument()

		expect(screen.getByText('248')).toBeInTheDocument()
		expect(screen.getByText('221')).toBeInTheDocument()
		expect(screen.getByText('27')).toBeInTheDocument()
		expect(screen.getByRole('progressbar', { name: 'Preložené: 89 %' })).toBeInTheDocument()
		expect(screen.getByRole('progressbar', { name: 'Nepreložené: 11 %' })).toBeInTheDocument()
		expect(screen.queryByText('Na kontrolu')).not.toBeInTheDocument()

		const headers = within(getTable())
			.getAllByRole('columnheader')
			.filter((header) => header.getAttribute('scope') !== 'rowgroup')
			.map((header) => header.textContent)
		expect(headers).toEqual(['Kľúč', 'slovenčina', 'English', 'Stav'])

		const welcome = within(getRow('dashboard.welcome'))
		expect(welcome.getByText('loc:dashboard')).toBeInTheDocument()
		const updated = welcome.getByText('pred 2 min')
		expect(updated.tagName).toBe('TIME')
		expect(updated).toHaveAttribute('datetime', WELCOME.translations[ENGLISH.id]?.updatedAt)
		expect(updated).toHaveAttribute('title', expect.stringMatching(/^\d{1,2}\. \d{1,2}\. \d{4},? \d{2}:\d{2}$/))
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
			pageSize: 20,
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
			pageSize: 20,
		})
		expect(screen.getByRole('textbox', { name: 'Hľadať kľúč alebo preklad' })).toHaveValue('welcome')
		expect(screen.getByRole('combobox', { name: 'Stav' })).toHaveValue('Preložené')
		expect(screen.getByRole('combobox', { name: 'Zoradenie' })).toHaveValue('Podľa kľúča')
	})

	it('ignores invalid URL values and keeps the defaults', async () => {
		const requests = mockPage()
		renderApp(`${PAGE_PATH}?status=REVIEW&sort=RANDOM&source=pl&page=0`)

		await screen.findByText('orders.empty.title')
		expect(lastParams(requests)).toEqual({ sourceLanguageId: SLOVAK.id, targetLanguageId: ENGLISH.id, sort: 'UNTRANSLATED_FIRST', page: 1, pageSize: 20 })
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
				pageSize: 20,
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
				return { status: 200, data: response({ total: 40, page, items: page > 2 ? [] : ITEMS }) }
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

	it('shows the empty state with Importovať that opens the import modal for a project without keys', async () => {
		mockPage({ translations: response({ items: [], total: 0, stats: { totalKeys: 0, translated: 0, untranslated: 0 }, namespaces: [] }) })
		renderApp(PAGE_PATH)

		expect(await findVisibleText('Projekt zatiaľ nemá žiadne kľúče. Pridáte ich importom súboru.')).toBeInTheDocument()
		expect(getAnnouncement('Projekt zatiaľ nemá žiadne kľúče. Pridáte ich importom súboru.')).toBeInTheDocument()
		const importButtons = screen.getAllByRole('button', { name: 'Importovať' })
		expect(importButtons).toHaveLength(2)
		importButtons.forEach((button) => expect(button).toBeEnabled())
		expect(screen.queryByText(/Zobrazených/)).not.toBeInTheDocument()

		fireEvent.click(importButtons[1]!)
		expect(await screen.findByRole('dialog', { name: 'Importovať preklady' })).toBeInTheDocument()
	})

	it('shows the empty state without asking for translations when the project has no languages', async () => {
		const requests = mockPage({ languages: [] })
		renderApp(PAGE_PATH)

		expect(await findVisibleText('Projekt zatiaľ nemá žiadne kľúče. Pridáte ich importom súboru.')).toBeInTheDocument()
		expect(requests()).toHaveLength(0)
	})

	it('shows a text and clears the filters when nothing matches', async () => {
		mockPage({ translations: response({ items: [], total: 0 }) })
		const router = renderApp(`${PAGE_PATH}?search=xyz&status=TRANSLATED&sort=KEY`)

		expect(await findVisibleText('Filtrom nezodpovedá žiadny kľúč.')).toBeInTheDocument()
		expect(getAnnouncement('Filtrom nezodpovedá žiadny kľúč.')).toBeInTheDocument()
		fireEvent.click(screen.getByRole('button', { name: 'Zrušiť filtre' }))

		await waitFor(() => expect(router.state.location.search).toEqual({ sort: 'KEY' }))
		expect(screen.getByRole('textbox', { name: 'Hľadať kľúč alebo preklad' })).toHaveValue('')
		expect(getTable()).toHaveFocus()
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

	it('paginates 20 per page and writes the page to the URL', async () => {
		const requests = mockPage({
			translations: (config) => ({ status: 200, data: response({ total: 120, page: (config.params as { page: number }).page }) }),
		})
		const router = renderApp(PAGE_PATH)

		expect(await findVisibleText('Zobrazených 4 z 120 kľúčov')).toBeInTheDocument()
		expect(getAnnouncement('Zobrazených 4 z 120 kľúčov')).toBeInTheDocument()
		const pagination = within(screen.getByRole('navigation', { name: 'Stránkovanie' }))
		expect(pagination.getByRole('button', { name: 'Predošlá' })).toHaveAttribute('aria-disabled', 'true')
		expect(pagination.getByRole('button', { name: 'Ďalšia' })).not.toHaveAttribute('aria-disabled')
		expect(pagination.getByRole('button', { name: 'Strana 1' })).toHaveAttribute('aria-current', 'page')
		expect(pagination.getByRole('button', { name: 'Strana 3' })).toBeInTheDocument()

		fireEvent.click(pagination.getByRole('button', { name: 'Ďalšia' }))

		await waitFor(() => expect(router.state.location.search).toEqual({ page: 2 }))
		await waitFor(() => expect(lastParams(requests)).toMatchObject({ page: 2 }))
		await waitFor(() => expect(pagination.getByRole('button', { name: 'Strana 2' })).toHaveAttribute('aria-current', 'page'))
	})

	it('keeps the focus on Ďalšia when it reaches the last page and ignores further clicks', async () => {
		const requests = mockPage({
			translations: (config) => ({ status: 200, data: response({ total: 60, page: (config.params as { page: number }).page }) }),
		})
		const router = renderApp(`${PAGE_PATH}?page=2`)

		const pagination = within(await screen.findByRole('navigation', { name: 'Stránkovanie' }))
		const next = pagination.getByRole('button', { name: 'Ďalšia' })
		next.focus()
		fireEvent.click(next)

		await waitFor(() => expect(pagination.getByRole('button', { name: 'Strana 3' })).toHaveAttribute('aria-current', 'page'))
		expect(next).toHaveAttribute('aria-disabled', 'true')
		expect(next).toHaveAttribute('data-disabled', 'true')
		expect(next).toHaveFocus()

		fireEvent.click(next)
		await waitFor(() => expect(lastParams(requests)).toMatchObject({ page: 3 }))
		expect(router.state.location.search).toEqual({ page: 3 })
	})

	it('announces the new count after a search', async () => {
		mockPage({
			translations: (config) => {
				const query = (config.params as { search?: string }).search
				return { status: 200, data: query ? response({ items: [ITEMS[2]!], total: 1 }) : response() }
			},
		})
		renderApp(PAGE_PATH)

		expect(await findVisibleText('Zobrazených 4 z 4 kľúčov')).toBeInTheDocument()
		fireEvent.change(screen.getByRole('textbox', { name: 'Hľadať kľúč alebo preklad' }), { target: { value: 'welcome' } })

		await waitFor(() => expect(getAnnouncement('Zobrazených 1 z 1 kľúča')).toBeInTheDocument())
	})

	it('moves the focus to the header Importovať when the empty state is gone by the time the import modal closes', async () => {
		let hasKeys = false
		mockPage({
			translations: () => ({
				status: 200,
				data: hasKeys ? response() : response({ items: [], total: 0, stats: { totalKeys: 0, translated: 0, untranslated: 0 }, namespaces: [] }),
			}),
		})
		renderApp(PAGE_PATH)

		await findVisibleText('Projekt zatiaľ nemá žiadne kľúče. Pridáte ich importom súboru.')
		const [headerImport, emptyStateImport] = screen.getAllByRole('button', { name: 'Importovať' })
		emptyStateImport!.focus()
		fireEvent.click(emptyStateImport!)
		const dialog = await screen.findByRole('dialog', { name: 'Importovať preklady' })

		hasKeys = true
		await act(() => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROJECTS.TRANSLATIONS_ALL(PROJECT.id) }))
		await within(getTable()).findByText('orders.empty.title')
		expect(emptyStateImport).not.toBeInTheDocument()

		fireEvent.click(within(dialog).getByRole('button', { name: 'Zavrieť' }))

		await waitFor(() => expect(dialog).not.toBeInTheDocument())
		await waitFor(() => expect(headerImport).toHaveFocus())
	})

	it('shows the relative time and texts in English', async () => {
		await i18n.changeLanguage('en')
		mockPage()
		renderApp(PAGE_PATH)

		expect(await screen.findByText('2 min ago')).toBeInTheDocument()
		expect(screen.getByRole('heading', { level: 1, name: 'Translations' })).toBeInTheDocument()
		expect(await findVisibleText('Showing 4 of 4 keys')).toBeInTheDocument()
	})
})

const WELCOME = ITEMS[2]!

const putUrl = (keyId: string) => `/projects/${PROJECT.id}/keys/${keyId}/translations/${ENGLISH.id}`

/**
 * In-memory list: a saved value survives the refetch after the mutation settles. `put` replaces the answer of every PUT (errors); as a
 * function it gets the sent value and falls back to the success answer when it returns `undefined`.
 */
const mockEditing = (put?: MockResponse | ((value: string | null) => MockResponse | undefined), user: AuthUser = ADMIN_USER, items = ITEMS) => {
	let current = response({ items, total: items.length })
	const putRoutes: MockRoutes = Object.fromEntries(
		items.map((entry) => [
			`PUT ${putUrl(entry.keyId)}`,
			(config: InternalAxiosRequestConfig) => {
				const { value } = JSON.parse(config.data as string) as { value: string | null }
				const replaced = typeof put === 'function' ? put(value) : put
				if (replaced) {
					return replaced
				}
				const target = cell(value, new Date().toISOString())
				const delta = target.status === entry.status ? 0 : target.status === 'TRANSLATED' ? 1 : -1
				current = {
					...current,
					items: current.items.map((candidate) =>
						candidate.keyId === entry.keyId
							? { ...candidate, status: target.status, translations: { ...candidate.translations, [ENGLISH.id]: target } }
							: candidate,
					),
					stats: { ...current.stats, translated: current.stats.translated + delta, untranslated: current.stats.untranslated - delta },
				}
				return { status: 200, data: target }
			},
		]),
	)
	const requests = signedInAs(user, {
		...projectListRoute(PROJECT),
		[`GET /projects/${PROJECT.id}/settings`]: { status: 200, data: PROJECT },
		[`GET /projects/${PROJECT.id}/languages`]: { status: 200, data: [SLOVAK, ENGLISH] },
		[`GET ${TRANSLATIONS_URL}`]: () => ({ status: 200, data: current }),
		...putRoutes,
	})
	return () => requests.filter((request) => request.method === 'put')
}

/** Holds every PUT until the returned function is called, so the optimistic state can be asserted first. */
const holdPuts = () => {
	const original = http.defaults.adapter as AxiosAdapter
	let release!: () => void
	const released = new Promise<void>((resolve) => {
		release = resolve
	})
	http.defaults.adapter = async (config) => {
		if (config.method === 'put') {
			await released
		}
		return original(config)
	}
	return release
}

const DIALOG = 'Upraviť preklad'

/** A real click focuses the cell button first; the modal returns the focus to it on close. */
const clickCell = (key: string, buttonName: string | RegExp) => {
	const button = within(getRow(key)).getByRole('button', { name: buttonName })
	act(() => button.focus())
	fireEvent.click(button)
}

const openModal = async (key: string, buttonName: string | RegExp) => {
	await screen.findByText('orders.empty.title')
	clickCell(key, buttonName)
	return screen.findByRole('dialog', { name: DIALOG })
}

const fieldOf = (dialog: HTMLElement, name: string | RegExp) => within(dialog).getByRole('textbox', { name })

const save = (dialog: HTMLElement) => fireEvent.click(within(dialog).getByRole('button', { name: 'Uložiť' }))

const waitForClosed = () => waitFor(() => expect(screen.queryByRole('dialog', { name: DIALOG })).not.toBeInTheDocument())

const WELCOME_BUTTON = 'Preklad kľúča dashboard.welcome, English: Welcome back, {{name}}'

/** Replaces the content of the contenteditable editor like typing would; the editor serializes the DOM on `input`. */
const typeText = (field: HTMLElement, text: string) => {
	if (document.activeElement !== field) {
		act(() => field.focus())
	}
	field.textContent = text
	fireEvent.input(field)
}

describe('TranslationsPage edit modal', () => {
	it('opens the modal from the cell with the key, the language, the base value and the field', async () => {
		mockEditing()
		renderApp(PAGE_PATH)

		const dialog = await openModal('dashboard.welcome', WELCOME_BUTTON)
		expect(within(dialog).getByText('dashboard.welcome')).toBeInTheDocument()
		expect(within(dialog).getByText('English')).toBeInTheDocument()
		expect(within(dialog).getByText('Základný jazyk (slovenčina)')).toBeInTheDocument()
		expect(within(dialog).getByText('Vitajte späť,', { exact: false })).toBeInTheDocument()
		const field = fieldOf(dialog, 'Preklad kľúča dashboard.welcome, English')
		expect(field).toHaveTextContent('Welcome back, {{name}}')
		await waitFor(() => expect(field).toHaveFocus())
		expect(field).toHaveAttribute('aria-multiline', 'true')
		expect(field).toHaveAccessibleDescription('Premenné a HTML značky sú zamknuté, mažú sa celé.')
		expect(field).toHaveAttribute('data-maxlength', '10000')
		const chip = within(field).getByText('{{name}}')
		expect(chip).toHaveAttribute('contenteditable', 'false')
		expect(chip).toHaveAttribute('data-token', '{{name}}')
		expect(within(dialog).getByRole('button', { name: 'Zrušiť' })).toBeInTheDocument()
	})

	it('saves with the button, closes, announces and returns the focus to the cell', async () => {
		const puts = mockEditing()
		renderApp(PAGE_PATH)

		const dialog = await openModal('dashboard.welcome', WELCOME_BUTTON)
		typeText(fieldOf(dialog, 'Preklad kľúča dashboard.welcome, English'), 'Welcome back, {{name}}!')
		save(dialog)

		await waitFor(() => expect(puts()).toHaveLength(1))
		expect(puts()[0]?.url).toBe(putUrl(WELCOME.keyId))
		expect(JSON.parse(puts()[0]?.data as string)).toEqual({ value: 'Welcome back, {{name}}!' })
		await waitForClosed()
		const row = within(getRow('dashboard.welcome'))
		const button = await row.findByRole('button', { name: 'Preklad kľúča dashboard.welcome, English: Welcome back, {{name}}!' })
		await waitFor(() => expect(button).toHaveFocus())
		expect(row.getAllByText('{{name}}').map((chip) => chip.tagName)).toEqual(['CODE', 'CODE'])
		expect(row.getByText('Preložené')).toBeInTheDocument()
		expect(getAnnouncement('Uložené: dashboard.welcome')).toBeInTheDocument()

		const description = await openModal('orders.empty.description', 'Preklad kľúča orders.empty.description, English: Bez prekladu')
		typeText(fieldOf(description, 'Preklad kľúča orders.empty.description, English'), 'New orders will show up here.')
		save(description)

		await waitFor(() => expect(puts()).toHaveLength(2))
		expect(puts()[1]?.url).toBe(putUrl(ITEMS[1]!.keyId))
		expect(JSON.parse(puts()[1]?.data as string)).toEqual({ value: 'New orders will show up here.' })
		await waitFor(() => expect(getRow('orders.empty.description')).toHaveAttribute('data-status', 'TRANSLATED'))
		await waitFor(() => expect(getAnnouncement('Uložené: orders.empty.description')).toBeInTheDocument())
	})

	it('does not save on Enter in the field, Zrušiť and Esc close without a request', async () => {
		const puts = mockEditing()
		renderApp(PAGE_PATH)

		const dialog = await openModal('dashboard.welcome', WELCOME_BUTTON)
		const field = fieldOf(dialog, 'Preklad kľúča dashboard.welcome, English')
		typeText(field, 'Changed')
		fireEvent.keyDown(field, { key: 'Enter' })
		expect(puts()).toHaveLength(0)
		expect(dialog).toBeInTheDocument()

		fireEvent.click(within(dialog).getByRole('button', { name: 'Zrušiť' }))
		await waitForClosed()
		expect(puts()).toHaveLength(0)
		expect(within(getRow('dashboard.welcome')).getByRole('button', { name: WELCOME_BUTTON })).toBeInTheDocument()

		const again = await openModal('dashboard.welcome', WELCOME_BUTTON)
		typeText(fieldOf(again, 'Preklad kľúča dashboard.welcome, English'), 'Changed again')
		fireEvent.keyDown(again, { key: 'Escape' })
		await waitForClosed()
		expect(puts()).toHaveLength(0)
		expect(within(getRow('dashboard.welcome')).getByRole('button', { name: WELCOME_BUTTON })).toBeInTheDocument()
	})

	it('reopens with the stored value after a cancelled draft', async () => {
		mockEditing()
		renderApp(PAGE_PATH)

		const dialog = await openModal('dashboard.welcome', WELCOME_BUTTON)
		typeText(fieldOf(dialog, 'Preklad kľúča dashboard.welcome, English'), 'Draft')
		fireEvent.click(within(dialog).getByRole('button', { name: 'Zrušiť' }))
		await waitForClosed()

		const again = await openModal('dashboard.welcome', WELCOME_BUTTON)
		expect(fieldOf(again, 'Preklad kľúča dashboard.welcome, English')).toHaveTextContent('Welcome back, {{name}}')
	})

	it('saves empty text as null and flips the status, the cell background and the stats optimistically', async () => {
		const puts = mockEditing()
		const release = holdPuts()
		renderApp(PAGE_PATH)

		const dialog = await openModal('dashboard.welcome', WELCOME_BUTTON)
		const field = fieldOf(dialog, 'Preklad kľúča dashboard.welcome, English')
		typeText(field, '   ')
		save(dialog)

		await waitFor(() => expect(getRow('dashboard.welcome')).toHaveAttribute('data-status', 'UNTRANSLATED'))
		expect(within(getRow('dashboard.welcome')).getByText('Nepreložené')).toBeInTheDocument()
		expect(screen.getByText('220')).toBeInTheDocument()
		expect(screen.getByText('28')).toBeInTheDocument()
		expect(field).toHaveAttribute('aria-readonly', 'true')
		expect(within(dialog).getByRole('button', { name: 'Zrušiť' })).toBeDisabled()
		expect(within(dialog).getByRole('button', { name: 'Zavrieť' })).toBeDisabled()

		release()

		await waitFor(() => expect(puts()).toHaveLength(1))
		expect(JSON.parse(puts()[0]?.data as string)).toEqual({ value: null })
		await waitForClosed()
		const button = within(getRow('dashboard.welcome')).getByRole('button', { name: 'Preklad kľúča dashboard.welcome, English: Bez prekladu' })
		expect(button).toHaveAttribute('data-status', 'UNTRANSLATED')
		expect(getRow('dashboard.welcome')).toHaveAttribute('data-status', 'UNTRANSLATED')
		expect(screen.getByText('220')).toBeInTheDocument()
	})

	it('keeps the modal open with the missing and extra variables on PLACEHOLDER_MISMATCH and rolls the list back', async () => {
		mockEditing(apiError(400, 'PLACEHOLDER_MISMATCH', { details: { missing: ['{{name}}'], extra: ['{{user}}'] } }))
		renderApp(PAGE_PATH)

		const dialog = await openModal('orders.empty.title', 'Preklad kľúča orders.empty.title, English: Bez prekladu')
		const field = fieldOf(dialog, 'Preklad kľúča orders.empty.title, English')
		typeText(field, 'Hello {{user}}')
		const submit = within(dialog).getByRole('button', { name: 'Uložiť' })
		act(() => submit.focus())
		fireEvent.click(submit)

		const alert = await within(dialog).findByRole('alert')
		expect(alert).toHaveTextContent('Premenné v preklade sa nezhodujú so základným jazykom. Chýbajú: {{name}}. Navyše: {{user}}.')
		// Uložiť was disabled while it loaded; the invalid field takes the focus instead of the body.
		expect(field).toHaveFocus()
		expect(field).toHaveTextContent('Hello {{user}}')
		expect(field).toHaveAttribute('aria-invalid', 'true')
		expect(field).not.toHaveAttribute('aria-readonly')
		expect(field).toHaveAccessibleDescription(/Chýbajú: \{\{name\}\}/)
		expect(getRow('orders.empty.title')).toHaveAttribute('data-status', 'UNTRANSLATED')
		expect(screen.getByText('221')).toBeInTheDocument()
		expect(screen.queryByText('English message that must not be shown')).not.toBeInTheDocument()

		fireEvent.click(within(dialog).getByRole('button', { name: 'Zrušiť' }))
		await waitForClosed()
		expect(within(getRow('orders.empty.title')).getByText('Bez prekladu')).toBeInTheDocument()
	})

	it('clears the error on typing and saves the corrected text after PLACEHOLDER_MISMATCH', async () => {
		const puts = mockEditing((value) =>
			value === 'Hello {{user}}' ? apiError(400, 'PLACEHOLDER_MISMATCH', { details: { missing: ['{{name}}'], extra: ['{{user}}'] } }) : undefined,
		)
		renderApp(PAGE_PATH)

		const dialog = await openModal('orders.empty.title', 'Preklad kľúča orders.empty.title, English: Bez prekladu')
		const field = fieldOf(dialog, 'Preklad kľúča orders.empty.title, English')
		typeText(field, 'Hello {{user}}')
		save(dialog)
		await within(dialog).findByRole('alert')

		typeText(field, 'Hello {{name}}')
		expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
		save(dialog)

		await waitForClosed()
		expect(puts()).toHaveLength(2)
		expect(JSON.parse(puts()[1]!.data as string)).toEqual({ value: 'Hello {{name}}' })
		expect(within(getRow('orders.empty.title')).getByText('{{name}}')).toBeInTheDocument()
		expect(getRow('orders.empty.title')).toHaveAttribute('data-status', 'TRANSLATED')
	})

	it('keeps the modal open, rolls back and shows a notification on another error', async () => {
		const show = vi.spyOn(notifications, 'show')
		const puts = mockEditing(apiError(500, 'INTERNAL_ERROR'))
		renderApp(PAGE_PATH)

		const dialog = await openModal('dashboard.welcome', WELCOME_BUTTON)
		typeText(fieldOf(dialog, 'Preklad kľúča dashboard.welcome, English'), 'Broken')
		save(dialog)

		await waitFor(() => expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'red', message: i18n.t('errors.INTERNAL_ERROR') })))
		expect(puts()).toHaveLength(1)
		expect(dialog).toBeInTheDocument()
		expect(fieldOf(dialog, 'Preklad kľúča dashboard.welcome, English')).toHaveTextContent('Broken')
		expect(within(getRow('dashboard.welcome')).getByRole('button', { name: WELCOME_BUTTON })).toBeInTheDocument()
		expect(screen.getByText('221')).toBeInTheDocument()
		expect(screen.queryByText(/Uložené/, { selector: STATUS })).not.toBeInTheDocument()
		show.mockRestore()
	})

	it('closes without a request when the value did not change', async () => {
		const puts = mockEditing()
		renderApp(PAGE_PATH)

		const dialog = await openModal('dashboard.welcome', WELCOME_BUTTON)
		save(dialog)

		await waitForClosed()
		expect(puts()).toHaveLength(0)
	})

	it('exposes every target cell as the only focusable element of its row for a member, so Tab goes to the next row', async () => {
		mockEditing(undefined, EDITOR_USER)
		renderApp(PAGE_PATH)
		await screen.findByText('orders.empty.title')

		const body = getTable().querySelector('tbody')
		const focusable = Array.from(body?.querySelectorAll('button, a, input, textarea, select, [tabindex]') ?? [])
		expect(focusable.map((element) => element.tagName)).toEqual(['BUTTON', 'BUTTON', 'BUTTON', 'BUTTON'])
		expect(focusable.map((element) => element.textContent)).toEqual([
			'Preklad kľúča orders.empty.title, English: Bez prekladu',
			'Preklad kľúča orders.empty.description, English: Bez prekladu',
			'Preklad kľúča dashboard.welcome, English: Welcome back, {{name}}',
			'Preklad kľúča Uložiť zmeny, English: Save changes',
		])
		expect(getRow('dashboard.welcome').querySelector('td:nth-child(2) button')).toBeNull()
		// Only the untranslated cells are red, never the row.
		expect(focusable.map((element) => element.getAttribute('data-status'))).toEqual(['UNTRANSLATED', 'UNTRANSLATED', 'TRANSLATED', 'TRANSLATED'])
	})

	it('adds the edit key button before the target cell of every row for an admin', async () => {
		mockEditing()
		renderApp(PAGE_PATH)
		await screen.findByText('orders.empty.title')

		const body = getTable().querySelector('tbody')
		const focusable = Array.from(body?.querySelectorAll('button, a, input, textarea, select, [tabindex]') ?? [])
		expect(focusable.map((element) => element.getAttribute('aria-label') ?? element.textContent)).toEqual([
			'Upraviť kľúč orders.empty.title',
			'Preklad kľúča orders.empty.title, English: Bez prekladu',
			'Upraviť kľúč orders.empty.description',
			'Preklad kľúča orders.empty.description, English: Bez prekladu',
			'Upraviť kľúč dashboard.welcome',
			'Preklad kľúča dashboard.welcome, English: Welcome back, {{name}}',
			'Upraviť kľúč Uložiť zmeny',
			'Preklad kľúča Uložiť zmeny, English: Save changes',
		])
	})
})

const PLURAL_ITEM = (): TranslationListItem => ({
	...item(
		'loc',
		'items.count',
		'{count, plural, one {# položka} few {# položky} many {# položiek} other {# položiek}}',
		'{count, plural, one {# item} other {# items}}',
	),
	plural: { variable: 'count' },
})

const formsOf = (cell: HTMLElement) =>
	Array.from(cell.querySelectorAll('span[title]')).map(
		(chip) => `${chip.textContent}: ${chip.parentElement?.textContent?.slice(chip.textContent?.length ?? 0) ?? ''}`,
	)

describe('TranslationsPage plural forms', () => {
	it('stacks the forms of the source and target language with # and {{…}} as chips', async () => {
		mockEditing(undefined, ADMIN_USER, [PLURAL_ITEM()])
		renderApp(PAGE_PATH)
		await screen.findByText('items.count')

		const row = getRow('items.count')
		const cells = row.querySelectorAll('td')
		expect(formsOf(cells[1] as HTMLElement)).toEqual(['One: # položka', 'Few: # položky', 'Many: # položiek', 'Other: # položiek'])
		expect(formsOf(cells[2] as HTMLElement)).toEqual(['One: # item', 'Other: # items'])
		expect(
			within(cells[1] as HTMLElement)
				.getAllByText('#')
				.map((chip) => `${chip.tagName} ${chip.getAttribute('title')}`),
		).toEqual(['CODE Číslo', 'CODE Číslo', 'CODE Číslo', 'CODE Číslo'])
		expect(within(cells[1] as HTMLElement).getByText('One')).toHaveAttribute('title', 'Jeden')
		expect(row).toHaveAttribute('data-status', 'TRANSLATED')
	})

	it('shows a missing form as untranslated and a non-plural value as the Other form', async () => {
		const items = [
			{ ...PLURAL_ITEM(), translations: { ...PLURAL_ITEM().translations, [ENGLISH.id]: cell('{count, plural, other {# items}}') } },
			{ ...item('loc', 'cart.items', 'Položky', 'Items'), plural: { variable: 'count' } },
		] satisfies TranslationListItem[]
		mockEditing(undefined, ADMIN_USER, items)
		renderApp(PAGE_PATH)
		await screen.findByText('items.count')

		const count = getRow('items.count').querySelectorAll('td')[2] as HTMLElement
		expect(formsOf(count)).toEqual(['One: Bez prekladu', 'Other: # items'])
		const cart = getRow('cart.items').querySelectorAll('td')[2] as HTMLElement
		expect(formsOf(cart)).toEqual(['One: Bez prekladu', 'Other: Items'])
	})

	const openPlural = async (name: string | RegExp = /Preklad kľúča items.count, English/) => {
		await screen.findByText('items.count')
		clickCell('items.count', name)
		return screen.findByRole('dialog', { name: DIALOG })
	}

	it('edits every form of the target language in its own field and saves one ICU message', async () => {
		const puts = mockEditing(undefined, ADMIN_USER, [PLURAL_ITEM()])
		renderApp(PAGE_PATH)
		const dialog = await openPlural()

		const one = fieldOf(dialog, 'Preklad kľúča items.count, English, Jeden')
		const other = fieldOf(dialog, 'Preklad kľúča items.count, English, Iné')
		await waitFor(() => expect(one).toHaveFocus())
		expect(one).toHaveTextContent('# item')
		expect(one.querySelectorAll('[data-token]')).toHaveLength(1)
		expect(within(dialog).queryByRole('textbox', { name: /Málo/ })).not.toBeInTheDocument()
		expect(one).toHaveAccessibleDescription('Premenné a HTML značky sú zamknuté, mažú sa celé. Znak # je miesto čísla.')
		expect(one.querySelector('[data-token="#"]')).toHaveAttribute('title', 'Číslo')
		// The base language forms are the reference.
		expect(formsOf(within(dialog).getByText('Základný jazyk (slovenčina)').parentElement as HTMLElement)).toEqual([
			'One: # položka',
			'Few: # položky',
			'Many: # položiek',
			'Other: # položiek',
		])

		typeText(other, '# items!')
		save(dialog)

		await waitFor(() => expect(puts()).toHaveLength(1))
		expect(JSON.parse(puts()[0]?.data as string)).toEqual({ value: '{count, plural, one {# item} other {# items!}}' })
		await within(getRow('items.count')).findByText('items!', { exact: false })
	})

	it('edits the four Slovak forms and keeps an empty form as an empty string', async () => {
		const puts = mockEditing(undefined, ADMIN_USER, [
			{
				...PLURAL_ITEM(),
				status: 'UNTRANSLATED',
				translations: { [ENGLISH.id]: cell('{count, plural, one {# item} other {# items}}'), [SLOVAK.id]: cell(null) },
			},
		])
		renderApp(`${PAGE_PATH}?source=en&target=sk`)
		const dialog = await openPlural('Preklad kľúča items.count, slovenčina: Bez prekladu')

		const fields = within(dialog).getAllByRole('textbox', { name: /Preklad kľúča items.count, slovenčina/ })
		expect(fields.map((field) => field.getAttribute('aria-label'))).toEqual([
			'Preklad kľúča items.count, slovenčina, Jeden',
			'Preklad kľúča items.count, slovenčina, Málo',
			'Preklad kľúča items.count, slovenčina, Veľa',
			'Preklad kľúča items.count, slovenčina, Iné',
		])
		// Slovak is the base language, so there is no reference block.
		expect(within(dialog).queryByText(/Základný jazyk/)).not.toBeInTheDocument()
		typeText(fields[0]!, '# položka')
		typeText(fields[3]!, '# položiek')
		save(dialog)

		await waitFor(() => expect(puts()).toHaveLength(1))
		expect(JSON.parse(puts()[0]?.data as string)).toEqual({ value: '{count, plural, one {# položka} few {} many {} other {# položiek}}' })
	})

	it('saves null when every form is empty', async () => {
		const puts = mockEditing(undefined, ADMIN_USER, [PLURAL_ITEM()])
		renderApp(PAGE_PATH)
		const dialog = await openPlural()

		typeText(fieldOf(dialog, 'Preklad kľúča items.count, English, Jeden'), '')
		typeText(fieldOf(dialog, 'Preklad kľúča items.count, English, Iné'), '  ')
		save(dialog)

		await waitFor(() => expect(puts()).toHaveLength(1))
		expect(JSON.parse(puts()[0]?.data as string)).toEqual({ value: null })
		await waitFor(() => expect(getRow('items.count')).toHaveAttribute('data-status', 'UNTRANSLATED'))
	})

	it('closes without a request when no form changed', async () => {
		const puts = mockEditing(undefined, ADMIN_USER, [PLURAL_ITEM()])
		renderApp(PAGE_PATH)
		const dialog = await openPlural()

		save(dialog)

		await waitForClosed()
		expect(puts()).toHaveLength(0)
	})

	it('keeps the modal open without a request when a form has unbalanced braces, then saves the fixed form', async () => {
		const puts = mockEditing(undefined, ADMIN_USER, [PLURAL_ITEM()])
		renderApp(PAGE_PATH)
		const dialog = await openPlural()

		const one = fieldOf(dialog, 'Preklad kľúča items.count, English, Jeden')
		const other = fieldOf(dialog, 'Preklad kľúča items.count, English, Iné')
		typeText(other, '# items}')
		save(dialog)

		expect(within(dialog).getByRole('alert')).toHaveTextContent('Zátvorky { a } musia byť vyvážené.')
		expect(other).toHaveAttribute('aria-invalid', 'true')
		expect(other).toHaveFocus()
		expect(one).not.toHaveAttribute('aria-invalid')
		expect(other).toHaveAccessibleDescription(/Zátvorky \{ a \} musia byť vyvážené\./)
		expect(puts()).toHaveLength(0)

		typeText(other, '# items!')
		save(dialog)

		await waitFor(() => expect(puts()).toHaveLength(1))
		expect(JSON.parse(puts()[0]?.data as string)).toEqual({ value: '{count, plural, one {# item} other {# items!}}' })
		await waitForClosed()
	})

	it('keeps the modal open without a request when the whole ICU message would exceed the limit', async () => {
		const puts = mockEditing(undefined, ADMIN_USER, [PLURAL_ITEM()])
		renderApp(PAGE_PATH)
		const dialog = await openPlural()

		const one = fieldOf(dialog, 'Preklad kľúča items.count, English, Jeden')
		const other = fieldOf(dialog, 'Preklad kľúča items.count, English, Iné')
		typeText(one, 'a'.repeat(6000))
		typeText(other, 'b'.repeat(6000))
		save(dialog)

		expect(within(dialog).getByRole('alert')).toHaveTextContent('Preklad je príliš dlhý (max. 10 000 znakov spolu za všetky formy).')
		expect(one).toHaveAttribute('aria-invalid', 'true')
		expect(other).toHaveAttribute('aria-invalid', 'true')
		expect(puts()).toHaveLength(0)
	})

	it('shows the brace message under the fields when the server rejects the plural value as INVALID', async () => {
		const show = vi.spyOn(notifications, 'show')
		const puts = mockEditing(apiError(400, 'VALIDATION_ERROR', { details: [{ path: 'value', code: 'INVALID' }] }), ADMIN_USER, [PLURAL_ITEM()])
		renderApp(PAGE_PATH)
		const dialog = await openPlural()

		const other = fieldOf(dialog, 'Preklad kľúča items.count, English, Iné')
		typeText(other, '# items!')
		save(dialog)

		const alert = await within(dialog).findByRole('alert')
		expect(alert).toHaveTextContent('Zátvorky { a } musia byť vyvážené.')
		expect(other).toHaveAttribute('aria-invalid', 'true')
		expect(puts()).toHaveLength(1)
		expect(show).not.toHaveBeenCalled()
		show.mockRestore()
	})
})

describe('TranslationsPage extended view', () => {
	const viewRadio = (name: string) => screen.getByRole('radio', { name })

	const cellButtons = (key: string) => within(getRow(key)).getAllByRole('button', { name: /Preklad kľúča/ })

	it('is the default: a column per language, every cell editable, no language pair in the request or the toolbar', async () => {
		const requests = mockPage({ user: EXTENDED_ADMIN, languages: [SLOVAK, ENGLISH] })
		renderApp(`${PAGE_PATH}?source=en&target=sk`)
		await screen.findByText('orders.empty.title')

		const params = lastParams(requests)
		expect(params).toMatchObject({ sort: 'UNTRANSLATED_FIRST', page: 1, pageSize: 20 })
		expect(params).not.toHaveProperty('sourceLanguageId')
		expect(params).not.toHaveProperty('targetLanguageId')
		expect(viewRadio('Všetky jazyky')).toBeChecked()
		expect(screen.queryByRole('combobox', { name: 'Zdrojový jazyk' })).not.toBeInTheDocument()
		expect(screen.queryByRole('combobox', { name: 'Cieľový jazyk' })).not.toBeInTheDocument()

		const table = getTable()
		expect(table).toHaveAttribute('data-view', 'EXTENDED')
		const headers = within(table)
			.getAllByRole('columnheader')
			.filter((header) => header.getAttribute('scope') !== 'rowgroup')
		expect(headers.map((header) => header.textContent)).toEqual(['Kľúč', 'slovenčina', 'English', 'Stav'])
		expect(headers[0]?.className).toMatch(/stickyStart/)
		expect(headers[3]?.className).toMatch(/stickyEnd/)
		expect(
			within(headers[1] as HTMLElement)
				.getByText('slovenčina')
				.parentElement?.querySelector('[data-flag="sk"]'),
		).toBeInTheDocument()

		// Both languages are buttons; only the empty cell is red, the row status comes from the API.
		const title = cellButtons('orders.empty.title')
		expect(title.map((button) => button.textContent)).toEqual([
			'Preklad kľúča orders.empty.title, slovenčina: Zatiaľ tu nie sú žiadne objednávky',
			'Preklad kľúča orders.empty.title, English: Bez prekladu',
		])
		expect(title.map((button) => button.getAttribute('data-status'))).toEqual(['TRANSLATED', 'UNTRANSLATED'])
		expect(getRow('orders.empty.title')).toHaveAttribute('data-status', 'UNTRANSLATED')
		expect(getRow('orders.empty.title').querySelector('td')?.className).toMatch(/stickyStart/)
		expect(cellButtons('dashboard.welcome').map((button) => button.getAttribute('data-status'))).toEqual(['TRANSLATED', 'TRANSLATED'])
		// The group label scrolls with the sticky key column.
		expect(within(table).getAllByText('loc:orders.empty')[0]?.className).toMatch(/groupLabel/)
	})

	it('switches to the compact view, saves the preference and asks for the language pair', async () => {
		const compactProfile = { ...EXTENDED_ADMIN, preferences: { translationsView: 'COMPACT' }, passwordChangedAt: '2026-10-01T00:00:00.000Z' }
		const requests = mockPage({ user: EXTENDED_ADMIN, routes: { 'PATCH /profile/preferences': { status: 200, data: compactProfile } } })
		renderApp(PAGE_PATH)
		await screen.findByText('orders.empty.title')

		fireEvent.click(viewRadio('Zdroj → cieľ'))

		await waitFor(() => expect(screen.getByRole('combobox', { name: 'Cieľový jazyk' })).toBeInTheDocument())
		expect(viewRadio('Zdroj → cieľ')).toBeChecked()
		await waitFor(() => expect(lastParams(requests)).toMatchObject({ sourceLanguageId: SLOVAK.id, targetLanguageId: ENGLISH.id }))
		expect(getTable()).toHaveAttribute('data-view', 'COMPACT')
		const patches = requests().filter((request) => request.method === 'patch')
		expect(patches).toHaveLength(0)
		expect(queryClient.getQueryData<AuthUser>(QUERY_KEYS.AUTH.ME())?.preferences.translationsView).toBe('COMPACT')
	})

	it('falls back to the extended view with a notification when saving the preference fails', async () => {
		const show = vi.spyOn(notifications, 'show')
		mockPage({ user: EXTENDED_ADMIN, routes: { 'PATCH /profile/preferences': apiError(500, 'INTERNAL_ERROR') } })
		renderApp(PAGE_PATH)
		await screen.findByText('orders.empty.title')

		fireEvent.click(viewRadio('Zdroj → cieľ'))

		await waitFor(() => expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'red', message: i18n.t('errors.INTERNAL_ERROR') })))
		await waitFor(() => expect(viewRadio('Všetky jazyky')).toBeChecked())
		expect(screen.queryByRole('combobox', { name: 'Cieľový jazyk' })).not.toBeInTheDocument()
		expect(getTable()).toHaveAttribute('data-view', 'EXTENDED')
		show.mockRestore()
	})

	it('edits a language from its cell and the row turns translated once every language has a value', async () => {
		const puts = mockEditing(undefined, EXTENDED_ADMIN)
		renderApp(PAGE_PATH)
		await screen.findByText('orders.empty.title')
		const english = cellButtons('orders.empty.title')[1]!
		act(() => english.focus())
		fireEvent.click(english)
		const dialog = await screen.findByRole('dialog', { name: DIALOG })
		expect(within(dialog).getByText('English')).toBeInTheDocument()
		expect(within(dialog).getByText('Základný jazyk (slovenčina)')).toBeInTheDocument()

		typeText(fieldOf(dialog, 'Preklad kľúča orders.empty.title, English'), 'No orders yet')
		save(dialog)

		await waitFor(() => expect(puts()).toHaveLength(1))
		expect(puts()[0]?.url).toBe(putUrl(ITEMS[0]!.keyId))
		await waitFor(() => expect(getRow('orders.empty.title')).toHaveAttribute('data-status', 'TRANSLATED'))
		expect(cellButtons('orders.empty.title').map((button) => button.getAttribute('data-status'))).toEqual(['TRANSLATED', 'TRANSLATED'])
		expect(screen.getByText('222')).toBeInTheDocument()
		expect(screen.getByText('26')).toBeInTheDocument()
	})
})
