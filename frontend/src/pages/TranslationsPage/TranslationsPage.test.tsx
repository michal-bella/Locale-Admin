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
import {
	ADMIN_USER as EXTENDED_ADMIN,
	apiError,
	CURRENT_VERSION,
	EDITOR_USER as EXTENDED_EDITOR,
	type MockRoutes,
	projectListRoute,
	signedInAs,
	VISITOR_USER as EXTENDED_VISITOR,
} from '@/test/mockApi'
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
const compact = (user: AuthUser): AuthUser => ({ ...user, preferences: { ...user.preferences, translationsView: 'COMPACT' } })

const ADMIN_USER = compact(EXTENDED_ADMIN)

const EDITOR_USER = compact(EXTENDED_EDITOR)
const VISITOR_USER = compact(EXTENDED_VISITOR)

const TRANSLATIONS_URL = `/projects/${PROJECT.id}/translations`

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60 * 1000).toISOString()

let keyIndex = 0

const cell = (value: string | null, updatedAt: string | null = null, updatedBy: TranslationCell['updatedBy'] = null): TranslationCell => ({
	value,
	status: value === null ? 'UNTRANSLATED' : 'TRANSLATED',
	updatedAt,
	updatedBy,
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
	stats: { totalKeys: 248, translated: 221, untranslated: 27, warnings: 0, untranslatedByLanguage: {} },
	namespaces: ['loc', 'paths'],
	editors: [],
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
		[`GET /projects/${PROJECT.id}/versions`]: { status: 200, data: { items: [CURRENT_VERSION] } },
		[`GET ${TRANSLATIONS_URL}`]: typeof translations === 'function' ? translations : { status: 200, data: translations },
		...routes,
	})
	// The banner counts the untranslated keys of the version with one more request (pageSize 1); the list requests are the rest.
	return () => requests.filter((request) => request.url === TRANSLATIONS_URL && (request.params as { pageSize: number }).pageSize !== 1)
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

/** Matches the innermost element whose whole text is `text`, also when it is split across children (a label with a flag and the language). */
const fullText = (text: string) => (_: string, element: Element | null) =>
	element?.textContent === text && ![...element.children].some((child) => child.textContent === text)

/** The warnings banner; the version banner above it is an alert too. */
const getWarningsBanner = () => {
	const banner = screen.getAllByRole('alert').find((alert) => within(alert).queryByRole('button', { name: /upozornen/ }))
	if (!banner) {
		throw new Error('Warnings banner not found')
	}
	return banner
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
		expect(screen.getByRole('button', { name: 'Exportovať' })).toBeEnabled()

		expect(screen.getByText('248')).toBeInTheDocument()
		expect(screen.getByText('221')).toBeInTheDocument()
		expect(screen.getByText('27')).toBeInTheDocument()
		expect(screen.getByRole('progressbar', { name: 'Preložené: 89 %' })).toBeInTheDocument()
		expect(screen.getByRole('progressbar', { name: 'Nepreložené: 11 %' })).toBeInTheDocument()
		expect(screen.getByText('89 % kľúčov')).toBeInTheDocument()
		expect(screen.getByText('11 % kľúčov')).toBeInTheDocument()
		expect(screen.queryByText('Na kontrolu')).not.toBeInTheDocument()

		const headers = within(getTable())
			.getAllByRole('columnheader')
			.filter((header) => header.getAttribute('scope') !== 'rowgroup')
			.map((header) => header.textContent)
		expect(headers).toEqual(['Kľúč', 'slovenčina Základný', 'angličtina', 'Stav'])

		const welcome = within(getRow('dashboard.welcome'))
		expect(welcome.getByText('loc:dashboard')).toBeInTheDocument()
		const updated = welcome.getByText('pred 2 min')
		expect(updated.tagName).toBe('TIME')
		expect(updated).toHaveAttribute('datetime', WELCOME.translations[ENGLISH.id]?.updatedAt)
		expect(updated).toHaveAttribute('title', expect.stringMatching(/^\d{1,2}\. \d{1,2}\. \d{4},? \d{2}:\d{2}$/))
		expect(welcome.getByText('Preložené')).toBeInTheDocument()
		expect(within(getRow('orders.empty.title')).getByText('Nepreložené')).toBeInTheDocument()
		expect(within(getRow('orders.empty.title')).getByText('Bez prekladu')).toBeInTheDocument()
		fireEvent.mouseEnter(within(getRow('orders.empty.title')).getByRole('button', { name: 'Preklad kľúča orders.empty.title, angličtina: Bez prekladu' }))
		expect(await screen.findByRole('tooltip')).toHaveTextContent('Nepreložené')
	})

	it('falls back to the latest change in any language when the target was never written', async () => {
		const sourceOnly = item('loc', 'orders.empty.title', 'Zatiaľ tu nie sú žiadne objednávky', null)
		sourceOnly.translations[SLOVAK.id] = cell('Zatiaľ tu nie sú žiadne objednávky', minutesAgo(5))
		mockPage({ translations: response({ items: [sourceOnly] }) })
		renderApp(PAGE_PATH)

		await screen.findByText('orders.empty.title')
		const updated = within(getRow('orders.empty.title')).getByText('pred 5 min')
		expect(updated).toHaveAttribute('datetime', sourceOnly.translations[SLOVAK.id]?.updatedAt)
	})

	it('asks for the base language → first other language, untranslated first, page 1 of 25 by default', async () => {
		const requests = mockPage({ languages: [SLOVAK, CZECH, ENGLISH] })
		renderApp(PAGE_PATH)

		await screen.findByText('orders.empty.title')
		expect(lastParams(requests)).toEqual({
			sourceLanguageId: SLOVAK.id,
			targetLanguageId: CZECH.id,
			versionId: CURRENT_VERSION.id,
			sort: 'UNTRANSLATED_FIRST',
			page: 1,
			pageSize: 25,
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
		renderApp(`${PAGE_PATH}?search=welcome&status=TRANSLATED&namespace=loc&sort=KEY&source=en&target=sk&page=2&pageSize=50`)

		await screen.findByText('orders.empty.title')
		expect(lastParams(requests)).toEqual({
			sourceLanguageId: ENGLISH.id,
			targetLanguageId: SLOVAK.id,
			versionId: CURRENT_VERSION.id,
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
		expect(lastParams(requests)).toEqual({
			sourceLanguageId: SLOVAK.id,
			targetLanguageId: ENGLISH.id,
			versionId: CURRENT_VERSION.id,
			sort: 'UNTRANSLATED_FIRST',
			page: 1,
			pageSize: 25,
		})
	})

	it('marks a variable the base language does not have and a missing one, never in the base language of a key without variables', async () => {
		mockPage({
			translations: response({
				items: [
					item('loc', 'margin', 'Marža {{ percentage }} % ({{ amount }})', 'Margin {{ perecentage }}%'),
					item('loc', 'greeting', 'Ahoj {{name}}', 'Hello {{name}}'),
					item('loc', 'account', 'Pokračovať s týmto účtom?', 'Continue with this account <strong>{{user}}</strong>?'),
				],
			}),
		})
		renderApp(PAGE_PATH)
		await screen.findByText('margin')

		const target = screen.getByRole('button', { name: /Preklad kľúča margin, angličtina/ })
		const warning = within(target).getByText('{{ perecentage }}')
		expect(warning.className).toMatch(/chipWarning/)
		expect(
			within(target).getByRole('img', {
				name: 'Chýbajú: {{percentage}}, {{amount}}. Navyše: {{perecentage}}. Premenná nie je v kľúči ani v základnom jazyku – skontrolujte preklep.',
			}),
		).toBeInTheDocument()
		// An extra variable alone gets the icon too, so a clamped long value still shows the warning.
		const account = screen.getByRole('button', { name: /Preklad kľúča account, angličtina/ })
		expect(
			within(account).getByRole('img', { name: 'Navyše: {{user}}. Premenná nie je v kľúči ani v základnom jazyku – skontrolujte preklep.' }),
		).toBeInTheDocument()
		// The cell has an orange border and explains the warning on hover of the whole cell; the chip and icon inside have no tooltips.
		expect(target).toHaveAttribute('data-warning', 'true')
		expect(account).toHaveAttribute('data-warning', 'true')
		fireEvent.mouseEnter(warning)
		expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
		fireEvent.mouseEnter(target)
		expect(await screen.findByRole('tooltip')).toHaveTextContent(
			'Chýbajú: {{percentage}}, {{amount}}. Navyše: {{perecentage}}. Premenná nie je v kľúči ani v základnom jazyku – skontrolujte preklep.',
		)

		// The base (source) value and a matching target get neither the chip nor the icon.
		expect(screen.getByText('{{ percentage }}').className).not.toMatch(/chipWarning/)
		screen.getAllByText('{{name}}').forEach((chip) => expect(chip.className).not.toMatch(/chipWarning/))
		expect(screen.getAllByRole('img')).toHaveLength(2)
		expect(screen.getByRole('button', { name: /Preklad kľúča greeting, angličtina/ })).not.toHaveAttribute('data-warning')
	})

	it('checks a sentence key against its name, so the base value that dropped a variable gets the warning', async () => {
		const name = 'Na udalosť je prihlásených {{count}} ľudí.'
		mockPage({ translations: response({ items: [item('loc', name, 'Klientom bude odoslaná notifikácia.', '{{count}} clients are booked.')] }) })
		renderApp(PAGE_PATH)
		await screen.findByText(name)

		const target = screen.getByRole('button', { name: /Preklad kľúča Na udalosť .*, angličtina/ })
		expect(within(target).queryByRole('img')).not.toBeInTheDocument()
		expect(screen.getByRole('img', { name: 'Chýbajú: {{count}}.' })).toBeInTheDocument()
		expect(screen.getAllByRole('img')).toHaveLength(1)
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

	it('drops the search and the other row filters when a stat card is clicked, keeps sort and view settings', async () => {
		mockPage()
		const router = renderApp(`${PAGE_PATH}?search=madar&namespace=loc&updatedWithin=WEEK&sort=KEY&page=2`)
		await screen.findByText('orders.empty.title')
		expect(screen.getByRole('textbox', { name: 'Hľadať kľúč alebo preklad' })).toHaveValue('madar')

		fireEvent.click(screen.getByRole('button', { name: 'Zobraziť nepreložené' }))
		await waitFor(() => expect(router.state.location.search).toEqual({ status: 'UNTRANSLATED', sort: 'KEY' }))
		expect(screen.getByRole('textbox', { name: 'Hľadať kľúč alebo preklad' })).toHaveValue('')

		fireEvent.click(screen.getByRole('button', { name: 'Zobraziť všetky' }))
		await waitFor(() => expect(router.state.location.search).toEqual({ sort: 'KEY' }))
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
				versionId: CURRENT_VERSION.id,
				status: 'UNTRANSLATED',
				namespace: 'paths',
				sort: 'UPDATED',
				page: 1,
				pageSize: 25,
			}),
		)

		await pickOption('Stav', 'Všetky stavy')
		await waitFor(() => expect(router.state.location.search).not.toHaveProperty('status'))
	})

	it('stacks the source and target in one column with the status in the key cell, saves the preference and keeps the page', async () => {
		const profile = (translationsLayout: 'COLUMNS' | 'STACKED') => ({
			...ADMIN_USER,
			preferences: { ...ADMIN_USER.preferences, translationsLayout },
			passwordChangedAt: '2026-10-01T00:00:00.000Z',
		})
		mockPage({
			routes: {
				'PATCH /profile/preferences': (config: InternalAxiosRequestConfig) => {
					const { translationsLayout } = JSON.parse(config.data as string) as { translationsLayout: 'COLUMNS' | 'STACKED' }
					return { status: 200, data: profile(translationsLayout) }
				},
			},
		})
		const router = renderApp(`${PAGE_PATH}?page=2`)
		await screen.findByText('orders.empty.title')

		expect(screen.getByRole('radio', { name: 'Jazyky vedľa seba' })).toBeChecked()
		fireEvent.click(screen.getByRole('radio', { name: 'Jazyky pod sebou' }))
		await waitFor(() => expect(getTable()).toHaveAttribute('data-layout', 'STACKED'))
		expect(router.state.location.search).toEqual({ page: 2 })
		await waitFor(() => expect(queryClient.getQueryData<AuthUser>(QUERY_KEYS.AUTH.ME())?.preferences.translationsLayout).toBe('STACKED'))

		const table = getTable()
		expect(table).toHaveAttribute('data-layout', 'STACKED')
		const headers = within(table)
			.getAllByRole('columnheader')
			.filter((header) => header.getAttribute('scope') !== 'rowgroup')
			.map((header) => header.textContent)
		expect(headers).toEqual(['Kľúč', 'Preklady'])

		const title = within(getRow('orders.empty.title'))
		expect(title.getAllByRole('cell')).toHaveLength(2)
		expect(title.getByText('Nepreložené')).toBeInTheDocument()
		const translations = title.getAllByRole('cell')[1] as HTMLElement
		expect(within(translations).getByText('slovenčina')).toBeInTheDocument()
		expect(within(translations).getByText('angličtina')).toBeInTheDocument()
		expect(within(translations).getByText('Zatiaľ tu nie sú žiadne objednávky')).toBeInTheDocument()
		expect(within(translations).getByRole('button', { name: /Preklad kľúča orders\.empty\.title, angličtina/ })).toBeInTheDocument()

		fireEvent.click(screen.getByRole('radio', { name: 'Jazyky vedľa seba' }))
		await waitFor(() => expect(getTable()).not.toHaveAttribute('data-layout'))
		expect(router.state.location.search).toEqual({ page: 2 })
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

	it('clears the search right away with the X or Esc and keeps the focus in the field', async () => {
		mockPage()
		const router = renderApp(`${PAGE_PATH}?search=objedn&page=2`)
		await screen.findByText('orders.empty.title')

		const input = screen.getByRole('textbox', { name: 'Hľadať kľúč alebo preklad' })
		fireEvent.click(screen.getByRole('button', { name: 'Vymazať vyhľadávanie' }))
		expect(input).toHaveValue('')
		expect(input).toHaveFocus()
		await waitFor(() => expect(router.state.location.search).toEqual({}))
		expect(screen.queryByRole('button', { name: 'Vymazať vyhľadávanie' })).not.toBeInTheDocument()

		fireEvent.change(input, { target: { value: 'save' } })
		await waitFor(() => expect(router.state.location.search).toEqual({ search: 'save' }))
		fireEvent.keyDown(input, { key: 'Escape' })
		expect(input).toHaveValue('')
		await waitFor(() => expect(router.state.location.search).toEqual({}))
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

	it('shows {{var}} and HTML tags as chips, never rendering the HTML', async () => {
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
		expect(within(terms).getByText('<a href="/terms">').tagName).toBe('CODE')
		expect(terms).toHaveTextContent('Súhlasím s <a href="/terms">podmienkami</a>')
		expect(within(terms).getByText('<strong>').tagName).toBe('CODE')
		expect(within(terms).getByText('<img src=x onerror=alert(1)>').tagName).toBe('CODE')
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
		mockPage({
			translations: response({
				items: [],
				total: 0,
				stats: { totalKeys: 0, translated: 0, untranslated: 0, warnings: 0, untranslatedByLanguage: {} },
				namespaces: [],
			}),
		})
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

	it('shows an EDITOR Exportovať but no Importovať, also not in the empty state', async () => {
		mockPage({
			user: EDITOR_USER,
			translations: response({
				items: [],
				total: 0,
				stats: { totalKeys: 0, translated: 0, untranslated: 0, warnings: 0, untranslatedByLanguage: {} },
				namespaces: [],
			}),
		})
		renderApp(PAGE_PATH)

		expect(await findVisibleText('Projekt zatiaľ nemá žiadne kľúče. Pridá ich administrátor importom súboru.')).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Exportovať' })).toBeEnabled()
		expect(screen.queryByRole('button', { name: 'Importovať' })).not.toBeInTheDocument()
	})

	it('shows the warnings banner with the count, filters by warnings from it in the extended view and clears the filter again', async () => {
		const requests = mockPage({
			translations: response({ stats: { totalKeys: 248, translated: 221, untranslated: 27, warnings: 3, untranslatedByLanguage: {} } }),
			routes: { 'PATCH /profile/preferences': { status: 200, data: { ...EXTENDED_ADMIN, passwordChangedAt: '2026-10-01T00:00:00.000Z' } } },
		})
		const router = renderApp(PAGE_PATH)
		await screen.findByText('orders.empty.title')

		const banner = getWarningsBanner()
		expect(banner).toHaveTextContent('3 kľúče majú premenné, ktoré sa líšia od kľúča alebo základného jazyka, napríklad po importe.')
		expect(getTable()).toHaveAttribute('data-view', 'COMPACT')
		fireEvent.click(within(banner).getByRole('button', { name: 'Zobraziť upozornenia' }))
		await waitFor(() => expect(router.state.location.search).toEqual({ warnings: true }))
		// A warning can be in any language, not only the target, so the compact view gives way to the extended one.
		await waitFor(() => expect(getTable()).toHaveAttribute('data-view', 'EXTENDED'))
		expect(queryClient.getQueryData<AuthUser>(QUERY_KEYS.AUTH.ME())?.preferences.translationsView).toBe('EXTENDED')
		await waitFor(() => expect(lastParams(requests)).toMatchObject({ warnings: true }))
		expect(lastParams(requests)).toMatchObject({ page: 1 })

		fireEvent.click(within(getWarningsBanner()).getByRole('button', { name: 'Zrušiť filter upozornení' }))
		await waitFor(() => expect(router.state.location.search).toEqual({}))
		await waitFor(() => expect(lastParams(requests).warnings).toBeUndefined())
	})

	it('shows no warnings banner when no key has a warning, unless the filter is on in the URL', async () => {
		mockPage()
		renderApp(PAGE_PATH)
		await screen.findByText('orders.empty.title')
		expect(screen.queryByRole('button', { name: /upozornen/ })).not.toBeInTheDocument()
	})

	it('keeps the banner with Zrušiť filter when the URL filter is on and another filter hides its keys, and Zrušiť filtre drops it too', async () => {
		mockPage({
			translations: response({
				items: [],
				total: 0,
				stats: { totalKeys: 248, translated: 221, untranslated: 27, warnings: 2, untranslatedByLanguage: {} },
			}),
		})
		const router = renderApp(`${PAGE_PATH}?warnings=true&search=missing`)

		expect(await findVisibleText('Filtrom nezodpovedá žiadny kľúč.')).toBeInTheDocument()
		expect(within(getWarningsBanner()).getByRole('button', { name: 'Zrušiť filter upozornení' })).toBeInTheDocument()
		fireEvent.click(screen.getByRole('button', { name: 'Zrušiť filtre' }))
		await waitFor(() => expect(router.state.location.search).toEqual({}))
	})

	it('shows the key description as an info icon with a tooltip instead of text under the key', async () => {
		const [first, ...rest] = ITEMS
		mockPage({ translations: response({ items: [{ ...(first as TranslationListItem), description: 'Shown above the order list' }, ...rest] }) })
		renderApp(PAGE_PATH)
		const row = await waitFor(() => getRow('orders.empty.title'))

		const icon = within(row).getByRole('img', { name: 'Popis kľúča: Shown above the order list' })
		expect(within(row).queryByText('Shown above the order list')).not.toBeInTheDocument()
		fireEvent.mouseEnter(icon)
		expect(await screen.findByRole('tooltip')).toHaveTextContent('Shown above the order list')
		expect(within(getRow('dashboard.welcome')).queryByRole('img', { name: /^Popis kľúča/ })).not.toBeInTheDocument()
	})

	it('shows a VISITOR only Exportovať, text cells that open nothing, and the filters', async () => {
		const requests = mockPage({ user: VISITOR_USER })
		renderApp(PAGE_PATH)
		await screen.findByText('orders.empty.title')

		expect(screen.getByRole('button', { name: 'Exportovať' })).toBeEnabled()
		expect(screen.queryByRole('button', { name: 'Importovať' })).not.toBeInTheDocument()
		expect(screen.queryByRole('button', { name: 'Pridať kľúč' })).not.toBeInTheDocument()
		const body = getTable().querySelector('tbody')
		expect(body?.querySelectorAll('button, a, input, textarea, select, [tabindex]')).toHaveLength(0)
		const cell = screen.getByText('Preklad kľúča orders.empty.title, angličtina:').closest('[data-status]')
		expect(cell?.tagName).toBe('DIV')
		expect(cell).toHaveAttribute('data-status', 'UNTRANSLATED')
		fireEvent.click(cell as HTMLElement)
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

		await pickOption('Stav', 'Nepreložené')
		await waitFor(() => expect(lastParams(requests)).toMatchObject({ status: 'UNTRANSLATED' }))
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

	it('paginates and writes the page to the URL', async () => {
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

	it('changes the keys per page, writes it to the URL and goes back to the first page', async () => {
		const requests = mockPage({
			translations: (config) => ({ status: 200, data: response({ total: 120, page: (config.params as { page: number }).page }) }),
		})
		const router = renderApp(`${PAGE_PATH}?page=2`)

		expect(await screen.findByRole('combobox', { name: 'Kľúčov na stranu' })).toHaveValue('25')

		await pickOption('Kľúčov na stranu', '50')
		await waitFor(() => expect(router.state.location.search).toEqual({ pageSize: 50 }))
		await waitFor(() => expect(lastParams(requests)).toMatchObject({ page: 1, pageSize: 50 }))

		await pickOption('Kľúčov na stranu', '25')
		await waitFor(() => expect(router.state.location.search).toEqual({}))
		await waitFor(() => expect(lastParams(requests)).toMatchObject({ page: 1, pageSize: 25 }))
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
				data: hasKeys
					? response()
					: response({
							items: [],
							total: 0,
							stats: { totalKeys: 0, translated: 0, untranslated: 0, warnings: 0, untranslatedByLanguage: {} },
							namespaces: [],
						}),
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
		expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Key', 'Slovak Base', 'English', 'Status'])
	})

	it('adds the missing translations of every language to the Nepreložené card in the extended view', async () => {
		mockPage({
			user: EXTENDED_ADMIN,
			translations: response({
				stats: { totalKeys: 248, translated: 221, untranslated: 27, warnings: 0, untranslatedByLanguage: { [SLOVAK.id]: 3, [ENGLISH.id]: 27 } },
			}),
		})
		renderApp(PAGE_PATH)
		await screen.findByText('orders.empty.title')

		expect(screen.getByText('11 % kľúčov · 30 chýbajúcich prekladov')).toBeInTheDocument()
		// The headers stay plain language names.
		expect(within(getTable()).getByRole('columnheader', { name: 'angličtina' })).toBeInTheDocument()
	})

	it('names the target language on the cards and in the version banner in the compact view', async () => {
		mockPage({
			user: compact(ADMIN_USER),
			translations: response({
				stats: { totalKeys: 248, translated: 221, untranslated: 27, warnings: 0, untranslatedByLanguage: { [SLOVAK.id]: 0, [ENGLISH.id]: 27 } },
			}),
		})
		renderApp(PAGE_PATH)
		await screen.findByText('orders.empty.title')

		const card = (label: string) => screen.getByText(label, { selector: 'p' }).closest('[data-tone]') as HTMLElement
		expect(within(card('Preložené')).getByText('angličtina')).toBeInTheDocument()
		expect(within(card('Nepreložené')).getByText('angličtina')).toBeInTheDocument()
		expect(within(card('Celkom kľúčov')).queryByText('angličtina')).not.toBeInTheDocument()
		// The missing translations are the target language's empty cells.
		expect(within(card('Nepreložené')).getByText('11 % kľúčov · 27 chýbajúcich prekladov')).toBeInTheDocument()
		expect(await screen.findByText('angličtina:')).toBeInTheDocument()
	})
})

const WELCOME = ITEMS[2]!

const putUrl = (keyId: string) => `/projects/${PROJECT.id}/keys/${keyId}/translations/${ENGLISH.id}`

/**
 * In-memory list: a saved value survives the refetch after the mutation settles. `put` replaces the answer of every PUT (errors); as a
 * function it gets the sent value and falls back to the success answer when it returns `undefined`.
 */
const mockEditing = (
	put?: MockResponse | ((value: string | null) => MockResponse | undefined),
	user: AuthUser = ADMIN_USER,
	items = ITEMS,
	untranslatedByLanguage: Record<string, number> = {},
) => {
	let current = response({ items, total: items.length, stats: { ...response().stats, untranslatedByLanguage } })
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
		[`GET /projects/${PROJECT.id}/versions`]: { status: 200, data: { items: [CURRENT_VERSION] } },
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

// Uložiť, or Uložiť a zavrieť while Uložiť a ďalší is shown next to it.
const SAVE_BUTTON = /^Uložiť( a zavrieť)?$/

const save = (dialog: HTMLElement) => fireEvent.click(within(dialog).getByRole('button', { name: SAVE_BUTTON }))

const waitForClosed = () => waitFor(() => expect(screen.queryByRole('dialog', { name: DIALOG })).not.toBeInTheDocument())

const WELCOME_BUTTON = 'Preklad kľúča dashboard.welcome, angličtina: Welcome back, {{name}}'

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
		expect(within(dialog).getByText(fullText('Základný jazyk (slovenčina)'))).toBeInTheDocument()
		expect(within(dialog).getByText(fullText('Preklad (angličtina)'))).toBeInTheDocument()
		expect(within(dialog).getByText('Vitajte späť,', { exact: false })).toBeInTheDocument()
		const field = fieldOf(dialog, 'Preklad kľúča dashboard.welcome, angličtina')
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

	it('copies the base language text into the field with the copy button, focused and ready to save', async () => {
		const puts = mockEditing()
		renderApp(PAGE_PATH)

		const dialog = await openModal('dashboard.welcome', WELCOME_BUTTON)
		const field = fieldOf(dialog, 'Preklad kľúča dashboard.welcome, angličtina')
		typeText(field, 'draft')
		fireEvent.click(within(dialog).getByRole('button', { name: 'Prevziať text zo základného jazyka (slovenčina) do prekladu' }))

		expect(field).toHaveTextContent('Vitajte späť, {{name}}')
		expect(field).toHaveFocus()
		expect(within(field).getByText('{{name}}')).toHaveAttribute('data-token', '{{name}}')
		save(dialog)
		await waitFor(() => expect(puts()).toHaveLength(1))
		expect(JSON.parse(puts()[0]?.data as string)).toEqual({ value: 'Vitajte späť, {{name}}' })
	})

	it('saves with the button, closes, announces and returns the focus to the cell', async () => {
		const puts = mockEditing()
		renderApp(PAGE_PATH)

		const dialog = await openModal('dashboard.welcome', WELCOME_BUTTON)
		typeText(fieldOf(dialog, 'Preklad kľúča dashboard.welcome, angličtina'), 'Welcome back, {{name}}!')
		save(dialog)

		await waitFor(() => expect(puts()).toHaveLength(1))
		expect(puts()[0]?.url).toBe(putUrl(WELCOME.keyId))
		expect(JSON.parse(puts()[0]?.data as string)).toEqual({ value: 'Welcome back, {{name}}!' })
		await waitForClosed()
		const row = within(getRow('dashboard.welcome'))
		const button = await row.findByRole('button', { name: 'Preklad kľúča dashboard.welcome, angličtina: Welcome back, {{name}}!' })
		await waitFor(() => expect(button).toHaveFocus())
		expect(row.getAllByText('{{name}}').map((chip) => chip.tagName)).toEqual(['CODE', 'CODE'])
		expect(row.getByText('Preložené')).toBeInTheDocument()
		expect(getAnnouncement('Uložené: dashboard.welcome')).toBeInTheDocument()

		const description = await openModal('orders.empty.description', 'Preklad kľúča orders.empty.description, angličtina: Bez prekladu')
		typeText(fieldOf(description, 'Preklad kľúča orders.empty.description, angličtina'), 'New orders will show up here.')
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
		const field = fieldOf(dialog, 'Preklad kľúča dashboard.welcome, angličtina')
		typeText(field, 'Changed')
		fireEvent.keyDown(field, { key: 'Enter' })
		expect(puts()).toHaveLength(0)
		expect(dialog).toBeInTheDocument()

		fireEvent.click(within(dialog).getByRole('button', { name: 'Zrušiť' }))
		await waitForClosed()
		expect(puts()).toHaveLength(0)
		expect(within(getRow('dashboard.welcome')).getByRole('button', { name: WELCOME_BUTTON })).toBeInTheDocument()

		const again = await openModal('dashboard.welcome', WELCOME_BUTTON)
		typeText(fieldOf(again, 'Preklad kľúča dashboard.welcome, angličtina'), 'Changed again')
		fireEvent.keyDown(again, { key: 'Escape' })
		await waitForClosed()
		expect(puts()).toHaveLength(0)
		expect(within(getRow('dashboard.welcome')).getByRole('button', { name: WELCOME_BUTTON })).toBeInTheDocument()
	})

	it('reopens with the stored value after a cancelled draft', async () => {
		mockEditing()
		renderApp(PAGE_PATH)

		const dialog = await openModal('dashboard.welcome', WELCOME_BUTTON)
		typeText(fieldOf(dialog, 'Preklad kľúča dashboard.welcome, angličtina'), 'Draft')
		fireEvent.click(within(dialog).getByRole('button', { name: 'Zrušiť' }))
		await waitForClosed()

		const again = await openModal('dashboard.welcome', WELCOME_BUTTON)
		expect(fieldOf(again, 'Preklad kľúča dashboard.welcome, angličtina')).toHaveTextContent('Welcome back, {{name}}')
	})

	it('saves empty text as null and flips the status, the cell background and the stats optimistically', async () => {
		const puts = mockEditing()
		const release = holdPuts()
		renderApp(PAGE_PATH)

		const dialog = await openModal('dashboard.welcome', WELCOME_BUTTON)
		const field = fieldOf(dialog, 'Preklad kľúča dashboard.welcome, angličtina')
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
		const button = within(getRow('dashboard.welcome')).getByRole('button', { name: 'Preklad kľúča dashboard.welcome, angličtina: Bez prekladu' })
		expect(button).toHaveAttribute('data-status', 'UNTRANSLATED')
		expect(getRow('dashboard.welcome')).toHaveAttribute('data-status', 'UNTRANSLATED')
		expect(screen.getByText('220')).toBeInTheDocument()
	})

	it('keeps the modal open with the missing and extra variables on PLACEHOLDER_MISMATCH and rolls the list back', async () => {
		mockEditing(apiError(400, 'PLACEHOLDER_MISMATCH', { details: { missing: ['{{name}}'], extra: ['{{user}}'] } }))
		renderApp(PAGE_PATH)

		const dialog = await openModal('orders.empty.title', 'Preklad kľúča orders.empty.title, angličtina: Bez prekladu')
		const field = fieldOf(dialog, 'Preklad kľúča orders.empty.title, angličtina')
		typeText(field, 'Hello {{user}}')
		// The label warns while typing, from the base value; the server's mismatch below is the mocked answer.
		expect(
			within(dialog).getByRole('img', { name: 'Navyše: {{user}}. Premenná nie je v kľúči ani v základnom jazyku – skontrolujte preklep.' }),
		).toBeInTheDocument()
		const submit = within(dialog).getByRole('button', { name: SAVE_BUTTON })
		act(() => submit.focus())
		fireEvent.click(submit)

		const alert = await within(dialog).findByRole('alert')
		expect(alert).toHaveTextContent('Premenné v preklade sa nezhodujú s kľúčom alebo základným jazykom. Chýbajú: {{name}}. Navyše: {{user}}.')
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

		const dialog = await openModal('orders.empty.title', 'Preklad kľúča orders.empty.title, angličtina: Bez prekladu')
		const field = fieldOf(dialog, 'Preklad kľúča orders.empty.title, angličtina')
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
		typeText(fieldOf(dialog, 'Preklad kľúča dashboard.welcome, angličtina'), 'Broken')
		save(dialog)

		await waitFor(() => expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'red', message: i18n.t('errors.INTERNAL_ERROR') })))
		expect(puts()).toHaveLength(1)
		expect(dialog).toBeInTheDocument()
		expect(fieldOf(dialog, 'Preklad kľúča dashboard.welcome, angličtina')).toHaveTextContent('Broken')
		expect(within(getRow('dashboard.welcome')).getByRole('button', { name: WELCOME_BUTTON })).toBeInTheDocument()
		expect(screen.getByText('221')).toBeInTheDocument()
		expect(screen.queryByText(/Uložené/, { selector: STATUS })).not.toBeInTheDocument()
		show.mockRestore()
	})

	it('counts the missing translations up optimistically when a translation is emptied', async () => {
		const puts = mockEditing(undefined, EXTENDED_ADMIN, ITEMS, { [SLOVAK.id]: 0, [ENGLISH.id]: 27 })
		const release = holdPuts()
		renderApp(PAGE_PATH)

		const dialog = await openModal('dashboard.welcome', WELCOME_BUTTON)
		typeText(fieldOf(dialog, 'Preklad kľúča dashboard.welcome, angličtina'), '   ')
		save(dialog)

		await waitFor(() => expect(screen.getByText(/· 28 chýbajúcich prekladov$/)).toBeInTheDocument())
		release()
		await waitFor(() => expect(puts()).toHaveLength(1))
	})

	it('keeps Uložiť disabled until the value changes', async () => {
		const puts = mockEditing()
		renderApp(PAGE_PATH)

		const dialog = await openModal('dashboard.welcome', WELCOME_BUTTON)
		const button = within(dialog).getByRole('button', { name: 'Uložiť' })
		expect(button).toBeDisabled()

		const field = fieldOf(dialog, 'Preklad kľúča dashboard.welcome, angličtina')
		typeText(field, 'Welcome, {{name}}')
		expect(button).toBeEnabled()
		typeText(field, 'Welcome back, {{name}}')
		expect(button).toBeDisabled()
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
			'Preklad kľúča orders.empty.title, angličtina: Bez prekladu',
			'Preklad kľúča orders.empty.description, angličtina: Bez prekladu',
			'Preklad kľúča dashboard.welcome, angličtina: Welcome back, {{name}}',
			'Preklad kľúča Uložiť zmeny, angličtina: Save changes',
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
			'Preklad kľúča orders.empty.title, angličtina: Bez prekladu',
			'Upraviť kľúč orders.empty.description',
			'Preklad kľúča orders.empty.description, angličtina: Bez prekladu',
			'Upraviť kľúč dashboard.welcome',
			'Preklad kľúča dashboard.welcome, angličtina: Welcome back, {{name}}',
			'Upraviť kľúč Uložiť zmeny',
			'Preklad kľúča Uložiť zmeny, angličtina: Save changes',
		])
	})

	it('shows who saved the value last and when, without a name for a deleted user and nothing for a missing row', async () => {
		const edited = {
			...WELCOME,
			translations: { ...WELCOME.translations, [ENGLISH.id]: cell('Welcome back, {{name}}', minutesAgo(5), { id: ADMIN_USER.id, name: 'Martin Kováč' }) },
		}
		mockEditing(undefined, ADMIN_USER, [ITEMS[0]!, ITEMS[1]!, edited, ITEMS[3]!])
		renderApp(PAGE_PATH)

		const dialog = await openModal('dashboard.welcome', WELCOME_BUTTON)
		// An info icon next to the field label; its tooltip adds the exact date and time.
		const lastEdit = within(dialog).getByRole('img', { name: 'Posledná úprava: Martin Kováč, pred 5 minútami' })
		fireEvent.mouseEnter(lastEdit)
		expect(await screen.findByRole('tooltip')).toHaveTextContent(/^Posledná úprava: Martin Kováč, pred 5 minútami\d{1,2}\. \d{1,2}\. \d{4},? \d{2}:\d{2}$/)
		fireEvent.click(within(dialog).getByRole('button', { name: 'Zrušiť' }))
		await waitForClosed()

		// The key equals its Slovak text, so the row cannot be found by its text.
		fireEvent.click(screen.getByRole('button', { name: /Preklad kľúča Uložiť zmeny, angličtina/ }))
		const saveChanges = await screen.findByRole('dialog', { name: DIALOG })
		expect(within(saveChanges).getByRole('img', { name: 'Posledná úprava: pred 3 hodinami' })).toBeInTheDocument()
		fireEvent.click(within(saveChanges).getByRole('button', { name: 'Zrušiť' }))
		await waitForClosed()

		const title = await openModal('orders.empty.title', 'Preklad kľúča orders.empty.title, angličtina: Bez prekladu')
		expect(within(title).queryByRole('img', { name: /Posledná úprava/ })).not.toBeInTheDocument()
	})

	it('opens Upraviť preklad of the key and language in the URL (a link from Prehľad) and drops them from the URL', async () => {
		mockEditing()
		const router = renderApp(`${PAGE_PATH}?search=dashboard.welcome&editKey=${WELCOME.keyId}&editLanguage=en`)

		const dialog = await screen.findByRole('dialog', { name: DIALOG })
		expect(within(dialog).getByRole('textbox', { name: 'Preklad kľúča dashboard.welcome, angličtina' })).toBeInTheDocument()
		await waitFor(() => expect(router.state.location.search).toEqual({ search: 'dashboard.welcome' }))
		expect(screen.getByRole('dialog', { name: DIALOG })).toBe(dialog)
	})

	it('only filters for a visitor, who cannot edit', async () => {
		mockEditing(undefined, VISITOR_USER)
		const router = renderApp(`${PAGE_PATH}?editKey=${WELCOME.keyId}&editLanguage=en`)

		await screen.findByText('dashboard.welcome')
		await waitFor(() => expect(router.state.location.search).toEqual({}))
		expect(screen.queryByRole('dialog', { name: DIALOG })).not.toBeInTheDocument()
	})

	it('saves and opens the next untranslated cell of the page with Uložiť a ďalší, then hides it on the last one', async () => {
		const puts = mockEditing()
		renderApp(PAGE_PATH)

		const dialog = await openModal('orders.empty.title', 'Preklad kľúča orders.empty.title, angličtina: Bez prekladu')
		// Like Uložiť a zavrieť next to it, it waits for a change; the shortcut does nothing either.
		expect(within(dialog).getByRole('button', { name: 'Uložiť a zavrieť' })).toBeDisabled()
		expect(within(dialog).getByRole('button', { name: 'Uložiť a ďalší' })).toBeDisabled()
		fireEvent.keyDown(fieldOf(dialog, 'Preklad kľúča orders.empty.title, angličtina'), { key: 'Enter', ctrlKey: true })
		expect(within(dialog).getByRole('textbox', { name: 'Preklad kľúča orders.empty.title, angličtina' })).toBeInTheDocument()
		typeText(fieldOf(dialog, 'Preklad kľúča orders.empty.title, angličtina'), 'No orders yet')
		expect(within(dialog).getByRole('button', { name: 'Uložiť a ďalší' })).toBeEnabled()
		fireEvent.click(within(dialog).getByRole('button', { name: 'Uložiť a ďalší' }))

		await waitFor(() => expect(puts()).toHaveLength(1))
		expect(puts()[0]?.url).toBe(putUrl(ITEMS[0]!.keyId))
		const next = await within(dialog).findByRole('textbox', { name: 'Preklad kľúča orders.empty.description, angličtina' })
		await waitFor(() => expect(next).toHaveFocus())
		expect(screen.getByRole('dialog', { name: DIALOG })).toBe(dialog)
		expect(within(dialog).queryByRole('button', { name: 'Uložiť a ďalší' })).not.toBeInTheDocument()
		expect(within(dialog).getByRole('button', { name: 'Uložiť' })).toHaveAttribute('aria-keyshortcuts', 'Meta+Enter Control+Enter')
	})

	it('saves and moves on with Ctrl+Enter or Cmd+Enter in the field without inserting a newline', async () => {
		const puts = mockEditing()
		renderApp(PAGE_PATH)

		const dialog = await openModal('orders.empty.title', 'Preklad kľúča orders.empty.title, angličtina: Bez prekladu')
		const field = fieldOf(dialog, 'Preklad kľúča orders.empty.title, angličtina')
		typeText(field, 'No orders yet')
		fireEvent.keyDown(field, { key: 'Enter', ctrlKey: true })

		await waitFor(() => expect(puts()).toHaveLength(1))
		expect(JSON.parse(puts()[0]?.data as string)).toEqual({ value: 'No orders yet' })
		const next = await within(dialog).findByRole('textbox', { name: 'Preklad kľúča orders.empty.description, angličtina' })

		typeText(next, 'New orders will show up here.')
		fireEvent.keyDown(next, { key: 'Enter', metaKey: true })
		await waitFor(() => expect(puts()).toHaveLength(2))
		expect(JSON.parse(puts()[1]?.data as string)).toEqual({ value: 'New orders will show up here.' })
		await waitForClosed()
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

	const openPlural = async (name: string | RegExp = /Preklad kľúča items.count, angličtina/) => {
		await screen.findByText('items.count')
		clickCell('items.count', name)
		return screen.findByRole('dialog', { name: DIALOG })
	}

	it('edits every form of the target language in its own field and saves one ICU message', async () => {
		const puts = mockEditing(undefined, ADMIN_USER, [PLURAL_ITEM()])
		renderApp(PAGE_PATH)
		const dialog = await openPlural()

		const one = fieldOf(dialog, 'Preklad kľúča items.count, angličtina, Jeden')
		const other = fieldOf(dialog, 'Preklad kľúča items.count, angličtina, Iné')
		await waitFor(() => expect(one).toHaveFocus())
		expect(one).toHaveTextContent('# item')
		expect(one.querySelectorAll('[data-token]')).toHaveLength(1)
		expect(within(dialog).queryByRole('textbox', { name: /Málo/ })).not.toBeInTheDocument()
		expect(one).toHaveAccessibleDescription('Premenné a HTML značky sú zamknuté, mažú sa celé. Znak # je miesto čísla.')
		expect(one.querySelector('[data-token="#"]')).toHaveAttribute('title', 'Číslo')
		// The base language forms are the reference.
		expect(formsOf(within(dialog).getByText(fullText('Základný jazyk (slovenčina)')).parentElement?.parentElement as HTMLElement)).toEqual([
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

	it('edits the three Slovak forms of whole numbers (no fraction-only Veľa) and keeps an empty form as an empty string', async () => {
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
			'Preklad kľúča items.count, slovenčina, Iné',
		])
		// Slovak is the base language, so there is no reference block.
		expect(within(dialog).queryByText(/Základný jazyk/)).not.toBeInTheDocument()
		typeText(fields[0]!, '# položka')
		typeText(fields[2]!, '# položiek')
		save(dialog)

		await waitFor(() => expect(puts()).toHaveLength(1))
		expect(JSON.parse(puts()[0]?.data as string)).toEqual({ value: '{count, plural, one {# položka} few {} other {# položiek}}' })
	})

	it('copies the base forms into the target forms, a form the base lacks taking its Other form', async () => {
		const puts = mockEditing(undefined, ADMIN_USER, [{ ...PLURAL_ITEM(), translations: { ...PLURAL_ITEM().translations, [ENGLISH.id]: cell(null) } }])
		renderApp(PAGE_PATH)
		const dialog = await openPlural('Preklad kľúča items.count, angličtina: Bez prekladu')

		fireEvent.click(within(dialog).getByRole('button', { name: 'Prevziať text zo základného jazyka (slovenčina) do prekladu' }))
		expect(fieldOf(dialog, 'Preklad kľúča items.count, angličtina, Jeden')).toHaveTextContent('# položka')
		expect(fieldOf(dialog, 'Preklad kľúča items.count, angličtina, Iné')).toHaveTextContent('# položiek')
		save(dialog)

		await waitFor(() => expect(puts()).toHaveLength(1))
		expect(JSON.parse(puts()[0]?.data as string)).toEqual({ value: '{count, plural, one {# položka} other {# položiek}}' })
	})

	it('saves null when every form is empty', async () => {
		const puts = mockEditing(undefined, ADMIN_USER, [PLURAL_ITEM()])
		renderApp(PAGE_PATH)
		const dialog = await openPlural()

		typeText(fieldOf(dialog, 'Preklad kľúča items.count, angličtina, Jeden'), '')
		typeText(fieldOf(dialog, 'Preklad kľúča items.count, angličtina, Iné'), '  ')
		save(dialog)

		await waitFor(() => expect(puts()).toHaveLength(1))
		expect(JSON.parse(puts()[0]?.data as string)).toEqual({ value: null })
		await waitFor(() => expect(getRow('items.count')).toHaveAttribute('data-status', 'UNTRANSLATED'))
	})

	it('keeps Uložiť disabled until a form changes', async () => {
		const puts = mockEditing(undefined, ADMIN_USER, [PLURAL_ITEM()])
		renderApp(PAGE_PATH)
		const dialog = await openPlural()
		const button = within(dialog).getByRole('button', { name: 'Uložiť' })
		expect(button).toBeDisabled()

		typeText(fieldOf(dialog, 'Preklad kľúča items.count, angličtina, Iné'), '# things')
		expect(button).toBeEnabled()
		expect(puts()).toHaveLength(0)
	})

	it('keeps the modal open without a request when a form has unbalanced braces, then saves the fixed form', async () => {
		const puts = mockEditing(undefined, ADMIN_USER, [PLURAL_ITEM()])
		renderApp(PAGE_PATH)
		const dialog = await openPlural()

		const one = fieldOf(dialog, 'Preklad kľúča items.count, angličtina, Jeden')
		const other = fieldOf(dialog, 'Preklad kľúča items.count, angličtina, Iné')
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

		const one = fieldOf(dialog, 'Preklad kľúča items.count, angličtina, Jeden')
		const other = fieldOf(dialog, 'Preklad kľúča items.count, angličtina, Iné')
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

		const other = fieldOf(dialog, 'Preklad kľúča items.count, angličtina, Iné')
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
		expect(params).toMatchObject({ sort: 'UNTRANSLATED_FIRST', page: 1, pageSize: 25 })
		expect(params).not.toHaveProperty('sourceLanguageId')
		expect(params).not.toHaveProperty('targetLanguageId')
		expect(viewRadio('Všetky jazyky')).toBeChecked()
		expect(screen.queryByRole('combobox', { name: 'Zdrojový jazyk' })).not.toBeInTheDocument()
		expect(screen.queryByRole('combobox', { name: 'Cieľový jazyk' })).not.toBeInTheDocument()
		expect(screen.getByRole('radio', { name: 'Jazyky vedľa seba' })).toBeChecked()

		const table = getTable()
		expect(table).toHaveAttribute('data-view', 'EXTENDED')
		const headers = within(table)
			.getAllByRole('columnheader')
			.filter((header) => header.getAttribute('scope') !== 'rowgroup')
		expect(headers.map((header) => header.textContent)).toEqual(['Kľúč', 'slovenčina Základný', 'angličtina', 'Stav'])
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
			'Preklad kľúča orders.empty.title, angličtina: Bez prekladu',
		])
		expect(title.map((button) => button.getAttribute('data-status'))).toEqual(['TRANSLATED', 'UNTRANSLATED'])
		expect(getRow('orders.empty.title')).toHaveAttribute('data-status', 'UNTRANSLATED')
		expect(getRow('orders.empty.title').querySelector('td')?.className).toMatch(/stickyStart/)
		expect(cellButtons('dashboard.welcome').map((button) => button.getAttribute('data-status'))).toEqual(['TRANSLATED', 'TRANSLATED'])
		// The group label scrolls with the sticky key column.
		expect(within(table).getAllByText('loc:orders.empty')[0]?.className).toMatch(/groupLabel/)
	})

	it('widens a language column by dragging the handle in its header, never below its default width nor past 800 px, and keeps the widths out of the URL', async () => {
		mockPage({ user: EXTENDED_ADMIN, languages: [SLOVAK, ENGLISH] })
		renderApp(PAGE_PATH)
		await screen.findByText('orders.empty.title')

		const header = screen.getByRole('columnheader', { name: 'angličtina' })
		const handle = header.querySelector('[data-resize-handle]')
		if (!handle) {
			throw new Error('Resize handle not found')
		}
		expect(handle).toHaveAttribute('aria-hidden', 'true')
		expect(header.style.width).toBe('')
		// jsdom lays nothing out, so give the header the 14 rem the stylesheet would.
		header.getBoundingClientRect = () => ({ width: 224 }) as DOMRect

		fireEvent.pointerDown(handle, { button: 0, clientX: 100 })
		expect(getTable().parentElement).toHaveAttribute('data-resizing', ENGLISH.id)
		fireEvent.pointerMove(window, { clientX: 400 })
		expect(header.style.width).toBe('524px')
		expect(header.style.minWidth).toBe('524px')
		fireEvent.pointerMove(window, { clientX: 2000 })
		expect(header.style.width).toBe('800px')
		fireEvent.pointerMove(window, { clientX: 20 })
		expect(header.style.width).toBe('224px')
		fireEvent.pointerUp(window)
		expect(getTable().parentElement).not.toHaveAttribute('data-resizing')
		fireEvent.pointerMove(window, { clientX: 600 })
		expect(header.style.width).toBe('224px')

		// Widened once, the default stays the minimum of the next drag too.
		header.getBoundingClientRect = () => ({ width: 524 }) as DOMRect
		fireEvent.pointerDown(handle, { button: 0, clientX: 100 })
		fireEvent.pointerMove(window, { clientX: 0 })
		expect(header.style.width).toBe('424px')
		fireEvent.pointerMove(window, { clientX: -500 })
		expect(header.style.width).toBe('224px')
		fireEvent.pointerUp(window)

		const keyHeader = screen.getByRole('columnheader', { name: 'Kľúč' })
		expect(keyHeader.querySelector('[data-resize-handle]')).toBeNull()
		expect(keyHeader.style.width).toBe('')
		expect(window.location.search).toBe('')
		expect(screen.getByRole('columnheader', { name: 'angličtina' })).toHaveTextContent('angličtina')
	})

	it('has no column resizing in the compact view', async () => {
		mockPage()
		renderApp(PAGE_PATH)
		await screen.findByText('orders.empty.title')

		expect(getTable().querySelector('[data-resize-handle]')).toBeNull()
	})

	it('stacks every language in one editable column with the STACKED layout preference', async () => {
		const user: AuthUser = { ...EXTENDED_ADMIN, preferences: { ...EXTENDED_ADMIN.preferences, translationsLayout: 'STACKED' } }
		mockPage({ user, languages: [SLOVAK, ENGLISH, CZECH] })
		renderApp(PAGE_PATH)
		await screen.findByText('orders.empty.title')

		expect(screen.getByRole('radio', { name: 'Jazyky pod sebou' })).toBeChecked()
		const table = getTable()
		expect(table).toHaveAttribute('data-layout', 'STACKED')
		const headers = within(table)
			.getAllByRole('columnheader')
			.filter((header) => header.getAttribute('scope') !== 'rowgroup')
		expect(headers.map((header) => header.textContent)).toEqual(['Kľúč', 'Preklady'])
		expect(headers[0]?.className).not.toMatch(/stickyStart/)

		const row = within(getRow('orders.empty.title'))
		expect(row.getAllByRole('cell')).toHaveLength(2)
		expect(row.getByText('Nepreložené')).toBeInTheDocument()
		expect(cellButtons('orders.empty.title').map((button) => button.textContent)).toEqual([
			'Preklad kľúča orders.empty.title, slovenčina: Zatiaľ tu nie sú žiadne objednávky',
			'Preklad kľúča orders.empty.title, angličtina: Bez prekladu',
			'Preklad kľúča orders.empty.title, čeština: Bez prekladu',
		])
	})

	it('switches to the compact view, saves the preference and asks for the language pair', async () => {
		const compactProfile = {
			...EXTENDED_ADMIN,
			preferences: { ...EXTENDED_ADMIN.preferences, translationsView: 'COMPACT' },
			passwordChangedAt: '2026-10-01T00:00:00.000Z',
		}
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
		expect(within(dialog).getByText(fullText('Základný jazyk (slovenčina)'))).toBeInTheDocument()

		typeText(fieldOf(dialog, 'Preklad kľúča orders.empty.title, angličtina'), 'No orders yet')
		save(dialog)

		await waitFor(() => expect(puts()).toHaveLength(1))
		expect(puts()[0]?.url).toBe(putUrl(ITEMS[0]!.keyId))
		await waitFor(() => expect(getRow('orders.empty.title')).toHaveAttribute('data-status', 'TRANSLATED'))
		expect(cellButtons('orders.empty.title').map((button) => button.getAttribute('data-status'))).toEqual(['TRANSLATED', 'TRANSLATED'])
		expect(screen.getByText('222')).toBeInTheDocument()
		expect(screen.getByText('26')).toBeInTheDocument()
	})

	it('shows the base language and the languages picked in the filter, without changing the request', async () => {
		const requests = mockPage({ user: EXTENDED_ADMIN, languages: [SLOVAK, ENGLISH, CZECH] })
		const router = renderApp(`${PAGE_PATH}?languages=${encodeURIComponent(JSON.stringify(['cs']))}`)
		await screen.findByText('orders.empty.title')

		const headers = () =>
			within(getTable())
				.getAllByRole('columnheader')
				.filter((header) => header.getAttribute('scope') !== 'rowgroup')
				.map((header) => header.textContent)
		expect(headers()).toEqual(['Kľúč', 'slovenčina Základný', 'čeština', 'Stav'])
		expect(lastParams(requests)).not.toHaveProperty('languages')

		await pickOption('Zobrazené jazyky', 'angličtina')
		await waitFor(() => expect(router.state.location.search).toEqual({ languages: ['cs', 'en'] }))
		expect(headers()).toEqual(['Kľúč', 'slovenčina Základný', 'angličtina', 'čeština', 'Stav'])

		// Mantine hides the clear button from assistive tech like the pill remove buttons; the keyboard clears with Backspace.
		fireEvent.click(screen.getByLabelText('Zobraziť všetky jazyky'))
		await waitFor(() => expect(router.state.location.search).toEqual({}))
		expect(headers()).toEqual(['Kľúč', 'slovenčina Základný', 'angličtina', 'čeština', 'Stav'])
		expect(screen.queryByLabelText('Zobraziť všetky jazyky')).not.toBeInTheDocument()
	})

	it('writes the editor and period filters to the URL and the request', async () => {
		const anna = { id: '00000000-0000-4000-8000-000000000777', name: 'Anna Nová' }
		const requests = mockPage({ user: EXTENDED_ADMIN, translations: response({ editors: [anna] }) })
		const router = renderApp(PAGE_PATH)
		await screen.findByText('orders.empty.title')

		await pickOption('Editor', 'Anna Nová')
		await waitFor(() => expect(router.state.location.search).toEqual({ updatedBy: anna.id }))
		await pickOption('Zmenené', 'Za posledných 7 dní')

		await waitFor(() => expect(router.state.location.search).toEqual({ updatedBy: anna.id, updatedWithin: 'WEEK' }))
		await waitFor(() => expect(lastParams(requests)).toMatchObject({ updatedById: anna.id, updatedWithin: 'WEEK' }))
	})

	it('hides the key and status columns with Len preklady and keeps the page', async () => {
		const requests = mockPage({ user: EXTENDED_ADMIN, languages: [SLOVAK, ENGLISH, CZECH] })
		const router = renderApp(`${PAGE_PATH}?page=2`)
		await screen.findByText('orders.empty.title')
		const headers = () =>
			within(getTable())
				.getAllByRole('columnheader')
				.filter((header) => header.getAttribute('scope') !== 'rowgroup')
				.map((header) => header.textContent)

		fireEvent.click(screen.getByRole('switch', { name: 'Len preklady' }))

		await waitFor(() => expect(router.state.location.search).toEqual({ page: 2, translationsOnly: true }))
		expect(headers()).toEqual(['slovenčina Základný', 'angličtina', 'čeština'])
		expect(within(getTable()).queryByText('orders.empty.title')).not.toBeInTheDocument()
		expect(within(getTable()).queryByText('Nepreložené')).not.toBeInTheDocument()
		expect(within(getTable()).getAllByRole('button', { name: /^Preklad kľúča orders\.empty\.title,/ })).toHaveLength(3)
		expect(lastParams(requests)).not.toHaveProperty('translationsOnly')
	})
})
