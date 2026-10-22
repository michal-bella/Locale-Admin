import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { type InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import {
	ACTIVITY_TYPE,
	type ActivityDailyResponse,
	type ActivityEvent,
	type ActivityEventData,
	type ActivityListResponse,
	type DashboardResponse,
	type LanguageListItem,
	type ProjectMember,
	type ProjectSettings,
	ROLE,
	SUPPORTED_LANGUAGES,
	TRANSLATIONS_SEARCH_MAX_LENGTH,
} from '@locale/shared'

import queryClient from '@/api/queryClient'
import { QUERY_KEYS } from '@/api/queryKeys'
import { ADMIN_USER, apiError, EDITOR_USER, type MockRoutes, projectListRoute, signedInAs, VISITOR_USER } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'

const PROJECT: ProjectSettings = {
	id: '00000000-0000-4000-8000-000000000301',
	name: 'Booking Web',
	slug: 'booking-web',
	primaryColor: '#E83E8C',
	protectVariables: true,
	baseLanguageId: null,
}

const PAGE_PATH = `/projects/${PROJECT.slug}/dashboard`
const API = `/projects/${PROJECT.id}`

const NOW = new Date(2026, 9, 20, 12, 0, 0)
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 60 * 60 * 1000).toISOString()

const DASHBOARD: DashboardResponse = {
	version: { id: '00000000-0000-4000-8000-000000000502', name: 'v2.45' },
	keys: { total: 248, createdLast30Days: 12 },
	translatedKeys: 221,
	strings: { filled: 690, total: 744 },
	baseWords: 900,
}

const toLanguage = (tag: LanguageListItem['tag'], index: number, translatedCount: number, isBase = false): LanguageListItem => {
	const supported = SUPPORTED_LANGUAGES.find((language) => language.tag === tag)
	if (!supported) {
		throw new Error(`Unknown tag ${tag}`)
	}
	return {
		id: `00000000-0000-4000-8000-0000000001${String(index).padStart(2, '0')}`,
		...supported,
		isBase,
		createdAt: '2026-10-01T10:00:00.000Z',
		translatedCount,
		keyCount: 248,
	}
}

const LANGUAGES = [toLanguage('sk', 1, 248, true), toLanguage('en', 2, 221), toLanguage('cs', 3, 178)]

const member = (index: number, role: ROLE, firstName: string | null, lastName: string | null): ProjectMember => ({
	id: `00000000-0000-4000-8000-0000000002${String(index).padStart(2, '0')}`,
	email: `member${index}@firma.sk`,
	firstName,
	lastName,
	role,
	projectCount: 1,
	createdAt: '2026-10-01T10:00:00.000Z',
})

const MEMBERS = [member(1, ROLE.ADMIN, 'Martin', 'Kováč'), member(2, ROLE.ADMIN, 'Lucia', 'Tichá'), member(3, ROLE.EDITOR, null, null)]

const MARTIN = { id: MEMBERS[0]?.id ?? '', name: 'Martin Kováč' }
const LUCIA = { id: MEMBERS[1]?.id ?? '', name: 'Lucia Tichá' }

let eventIndex = 0
const event = (data: ActivityEventData, createdAt = hoursAgo(1), user: ActivityEvent['user'] = MARTIN): ActivityEvent => {
	eventIndex += 1
	return { id: `00000000-0000-4000-8000-0000000004${String(eventIndex).padStart(2, '0')}`, createdAt, count: 1, user, version: null, ...data }
}

const activityPage = (items: ActivityEvent[], nextCursor: string | null = null): ActivityListResponse => ({ items, nextCursor })

const DAILY: ActivityDailyResponse = {
	days: [
		{ date: '2026-10-18', changes: 0 },
		{ date: '2026-10-19', changes: 2 },
		{ date: '2026-10-20', changes: 4 },
	],
	contributors: [
		{ user: MARTIN, changes: 5 },
		{ user: LUCIA, changes: 1 },
	],
}

const routes = (overrides: MockRoutes = {}): MockRoutes => ({
	...projectListRoute(PROJECT),
	[`GET ${API}/settings`]: { status: 200, data: PROJECT },
	[`GET ${API}/dashboard`]: { status: 200, data: DASHBOARD },
	[`GET ${API}/languages`]: { status: 200, data: LANGUAGES },
	[`GET ${API}/members`]: { status: 200, data: { members: MEMBERS } },
	[`GET ${API}/activity`]: { status: 200, data: activityPage([]) },
	[`GET ${API}/activity/daily`]: { status: 200, data: DAILY },
	...overrides,
})

/** `Intl` puts a no-break space between the number and `%` in sk. */
const text = (element: HTMLElement) => element.textContent?.replace(/\u00a0/g, ' ')

const findCard = async (label: string) => {
	const stats = await screen.findByRole('region', { name: 'Štatistiky projektu' })
	const card = within(stats).getByText(label).closest('div')?.parentElement?.parentElement
	if (!card) {
		throw new Error(`Card ${label} not found`)
	}
	return card
}

const searchOf = (link: HTMLElement) => new URL(link.getAttribute('href') ?? '', 'http://localhost')

const findActivity = async () => within(await screen.findByRole('region', { name: 'Posledná aktivita' }))

describe('DashboardPage', () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['Date'] })
		vi.setSystemTime(NOW)
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it('shows the header with Otvoriť preklady and no import or export button', async () => {
		signedInAs(ADMIN_USER, routes())
		renderApp(PAGE_PATH)

		expect(await screen.findByRole('heading', { level: 1, name: 'Booking Web' })).toBeInTheDocument()
		expect(screen.getByText('Prehľad projektu')).toBeInTheDocument()
		expect(screen.getByText('Aktuálny stav prekladov, jazykov a posledných zmien.')).toBeInTheDocument()
		expect(screen.getByRole('link', { name: 'Otvoriť preklady' })).toHaveAttribute('href', `/projects/${PROJECT.slug}/translations`)
		expect(screen.queryByRole('button', { name: /Importovať/ })).not.toBeInTheDocument()
		expect(screen.queryByRole('button', { name: /Exportovať/ })).not.toBeInTheDocument()
		expect(screen.queryByRole('link', { name: /Importovať|Exportovať/ })).not.toBeInTheDocument()
	})

	it('shows the key, translated, language and member cards', async () => {
		signedInAs(EDITOR_USER, routes())
		renderApp(PAGE_PATH)

		const keys = await findCard('Kľúče')
		await waitFor(() => expect(text(keys)).toContain('248+12 za 30 dní'))
		const translated = await findCard('Preložené')
		expect(text(translated)).toContain('89 %221 z 248 kľúčov')
		expect(text(await findCard('Jazyky'))).toContain('31 zdrojový')
		const members = await findCard('Členovia')
		await waitFor(() => expect(text(members)).toContain('32 administrátori'))

		const untranslated = within(translated).getByRole('link', { name: 'Zobraziť nepreložené' })
		expect(searchOf(untranslated).pathname).toBe(`/projects/${PROJECT.slug}/translations`)
		expect(searchOf(untranslated).searchParams.get('status')).toBe('UNTRANSLATED')
		expect(within(members).getByRole('link', { name: 'Zobraziť členov' })).toHaveAttribute('href', `/projects/${PROJECT.slug}/members`)
	})

	it.each([
		[221, 248, '89 %'],
		[247, 248, '> 99 %'],
		[1, 248, '< 1 %'],
		[248, 248, '100 %'],
		[0, 0, '0 %'],
	])('rounds %i of %i translated keys to %s', async (translatedKeys, total, percent) => {
		signedInAs(
			EDITOR_USER,
			routes({ [`GET ${API}/dashboard`]: { status: 200, data: { ...DASHBOARD, keys: { total, createdLast30Days: 0 }, translatedKeys } } }),
		)
		renderApp(PAGE_PATH)

		const card = await findCard('Preložené')
		await waitFor(() => expect(text(card)).toContain(`${percent}${translatedKeys} z ${total} kľúč`))
	})

	it('lists the languages and opens Preklady with the untranslated keys of a language', async () => {
		signedInAs(EDITOR_USER, routes())
		renderApp(PAGE_PATH)

		const list = within(await screen.findByRole('list', { name: 'Stav jazykov' }))
		const items = list.getAllByRole('listitem')
		expect(items.map(text)).toEqual(['Slovenčina100 %Zdrojový jazyk', 'Angličtina89 %221 z 248 preložených', 'Čeština72 %178 z 248 preložených'])
		expect(within(items[0] as HTMLElement).queryByRole('link')).not.toBeInTheDocument()

		const english = list.getByRole('link', { name: /^Angličtina: zobraziť nepreložené kľúče, 89\s%$/ })
		const url = searchOf(english)
		expect(url.pathname).toBe(`/projects/${PROJECT.slug}/translations`)
		expect(url.searchParams.get('target')).toBe('en')
		expect(JSON.parse(url.searchParams.get('languages') ?? '')).toEqual(['en'])
		expect(url.searchParams.get('status')).toBe('UNTRANSLATED')
		expect(screen.getByRole('link', { name: 'Spravovať jazyky' })).toHaveAttribute('href', `/projects/${PROJECT.slug}/languages`)
	})

	it('hides Spravovať jazyky and Zobraziť členov from a VISITOR and keeps the links to Preklady', async () => {
		signedInAs(VISITOR_USER, routes())
		renderApp(PAGE_PATH)

		const list = within(await screen.findByRole('list', { name: 'Stav jazykov' }))
		expect(list.getByRole('link', { name: /^Angličtina: zobraziť nepreložené kľúče/ })).toBeInTheDocument()
		expect(screen.queryByRole('link', { name: 'Spravovať jazyky' })).not.toBeInTheDocument()
		const members = await findCard('Členovia')
		await waitFor(() => expect(text(members)).toContain('administrátor'))
		expect(within(members).queryByRole('link', { name: 'Zobraziť členov' })).not.toBeInTheDocument()
		expect(screen.getByRole('link', { name: 'Otvoriť preklady' })).toHaveAttribute('href', `/projects/${PROJECT.slug}/translations`)
	})

	it.each<[string, ActivityEventData]>([
		['vytvorenie projektu Booking Web', { type: ACTIVITY_TYPE.PROJECT_CREATED, payload: { name: 'Booking Web' } }],
		['zmena nastavení projektu: názov a farba', { type: ACTIVITY_TYPE.PROJECT_UPDATED, payload: { fields: ['name', 'primaryColor'] } }],
		['pridanie jazyka angličtina', { type: ACTIVITY_TYPE.LANGUAGE_ADDED, payload: { tag: 'en' } }],
		['odobratie jazyka xx', { type: ACTIVITY_TYPE.LANGUAGE_REMOVED, payload: { tag: 'xx' } }],
		['nastavenie základného jazyka slovenčina', { type: ACTIVITY_TYPE.BASE_LANGUAGE_CHANGED, payload: { fromTag: null, toTag: 'sk' } }],
		['zmena základného jazyka z slovenčina na čeština', { type: ACTIVITY_TYPE.BASE_LANGUAGE_CHANGED, payload: { fromTag: 'sk', toTag: 'cs' } }],
		[
			'pridanie člena Lucia Tichá',
			{ type: ACTIVITY_TYPE.MEMBER_ADDED, payload: { member: { id: LUCIA.id, firstName: 'Lucia', lastName: 'Tichá', email: 'lucia@firma.sk' } } },
		],
		[
			'odobratie člena eva@firma.sk',
			{
				type: ACTIVITY_TYPE.MEMBER_REMOVED,
				payload: { member: { id: LUCIA.id, firstName: null, lastName: null, email: 'eva@firma.sk' }, left: false },
			},
		],
		[
			'odchod z projektu',
			{
				type: ACTIVITY_TYPE.MEMBER_REMOVED,
				payload: { member: { id: MARTIN.id, firstName: 'Martin', lastName: 'Kováč', email: 'm@firma.sk' }, left: true },
			},
		],
		[
			'import CSV: 5 prekladov a 3 nové kľúče',
			{ type: ACTIVITY_TYPE.KEYS_IMPORTED, payload: { keysCreated: 3, translationsCreated: 4, translationsUpdated: 1, languageTags: ['en'] } },
		],
		[
			'import CSV: 1 preklad',
			{ type: ACTIVITY_TYPE.KEYS_IMPORTED, payload: { keysCreated: 0, translationsCreated: 0, translationsUpdated: 1, languageTags: ['en'] } },
		],
		[
			'import CSV: 2 nové kľúče',
			{ type: ACTIVITY_TYPE.KEYS_IMPORTED, payload: { keysCreated: 2, translationsCreated: 0, translationsUpdated: 0, languageTags: [] } },
		],
		[
			'úprava kľúča orders.title: popis a plurál',
			{
				type: ACTIVITY_TYPE.KEY_UPDATED,
				payload: { keyId: '00000000-0000-4000-8000-000000000501', namespace: 'loc', name: 'orders.title', fields: ['description', 'pluralVariable'] },
			},
		],
		[
			'úprava prekladu orders.title (angličtina)',
			{
				type: ACTIVITY_TYPE.TRANSLATION_UPDATED,
				payload: {
					keyId: '00000000-0000-4000-8000-000000000501',
					namespace: 'loc',
					name: 'orders.title',
					languageTag: 'en',
					oldValue: 'Staré',
					newValue: 'Nové',
				},
			},
		],
	])('describes the event as "Martin Kováč · %s"', async (sentence, data) => {
		signedInAs(EDITOR_USER, routes({ [`GET ${API}/activity`]: { status: 200, data: activityPage([event(data)]) } }))
		renderApp(PAGE_PATH)

		const activity = await findActivity()
		expect(await activity.findByText(`· ${sentence}`, { exact: false })).toHaveTextContent(`Martin Kováč · ${sentence}`)
		expect(activity.queryByText('Staré', { exact: false })).not.toBeInTheDocument()
		expect(activity.queryByText('English message that must not be shown')).not.toBeInTheDocument()
	})

	it('groups events by day, links an edit to its key and an import to the changes of its user in Preklady and names a deleted user', async () => {
		const edit = event({
			type: ACTIVITY_TYPE.TRANSLATION_UPDATED,
			payload: { keyId: '00000000-0000-4000-8000-000000000501', namespace: 'loc', name: 'a.b', languageTag: 'en', oldValue: null, newValue: 'B' },
		})
		const importByLucia = event(
			{ type: ACTIVITY_TYPE.KEYS_IMPORTED, payload: { keysCreated: 0, translationsCreated: 2, translationsUpdated: 0, languageTags: ['en'] } },
			hoursAgo(30),
			LUCIA,
		)
		const byDeleted = event({ type: ACTIVITY_TYPE.LANGUAGE_ADDED, payload: { tag: 'cs' } }, hoursAgo(24 * 10), null)
		const deletedImport = event(
			{ type: ACTIVITY_TYPE.KEYS_IMPORTED, payload: { keysCreated: 0, translationsCreated: 1, translationsUpdated: 0, languageTags: ['en'] } },
			hoursAgo(24 * 10),
			null,
		)
		signedInAs(EDITOR_USER, routes({ [`GET ${API}/activity`]: { status: 200, data: activityPage([edit, importByLucia, byDeleted, deletedImport]) } }))
		renderApp(PAGE_PATH)

		const activity = await findActivity()
		const today = within(await activity.findByRole('list', { name: 'Dnes' }))
		expect(today.getByText(/^pred 1\sh$/)).toBeInTheDocument()
		const editLink = searchOf(today.getByRole('link', { name: 'Zobraziť preklad a.b v prekladoch' }))
		expect(editLink.pathname).toBe(`/projects/${PROJECT.slug}/translations`)
		expect(Object.fromEntries(editLink.searchParams)).toEqual({ search: 'a.b', namespace: 'loc' })

		const yesterday = within(activity.getByRole('list', { name: 'Včera' }))
		const importLink = searchOf(yesterday.getByRole('link', { name: 'Zobraziť zmeny používateľa Lucia Tichá v prekladoch' }))
		expect(Object.fromEntries(importLink.searchParams)).toEqual({ updatedBy: LUCIA.id, updatedWithin: 'WEEK' })

		const older = within(activity.getByRole('list', { name: '10. 10. 2026' }))
		expect(older.getAllByText('Odstránený používateľ')).toHaveLength(2)
		expect(older.queryByRole('link')).not.toBeInTheDocument()
	})

	it('links an edit by a deleted user to its key, and an edit of a key too long for the search to the changes of its user', async () => {
		const longName = 'k'.repeat(TRANSLATIONS_SEARCH_MAX_LENGTH + 1)
		const byDeleted = event(
			{
				type: ACTIVITY_TYPE.TRANSLATION_UPDATED,
				payload: { keyId: '00000000-0000-4000-8000-000000000501', namespace: 'paths', name: 'a.b', languageTag: 'en', oldValue: null, newValue: 'B' },
			},
			undefined,
			null,
		)
		const longKey = event({
			type: ACTIVITY_TYPE.TRANSLATION_UPDATED,
			payload: { keyId: '00000000-0000-4000-8000-000000000502', namespace: 'loc', name: longName, languageTag: 'en', oldValue: null, newValue: 'B' },
		})
		signedInAs(EDITOR_USER, routes({ [`GET ${API}/activity`]: { status: 200, data: activityPage([byDeleted, longKey]) } }))
		renderApp(PAGE_PATH)

		const activity = await findActivity()
		expect(Object.fromEntries(searchOf(await activity.findByRole('link', { name: 'Zobraziť preklad a.b v prekladoch' })).searchParams)).toEqual({
			search: 'a.b',
			namespace: 'paths',
		})
		expect(Object.fromEntries(searchOf(activity.getByRole('link', { name: 'Zobraziť zmeny používateľa Martin Kováč v prekladoch' })).searchParams)).toEqual(
			{
				updatedBy: MARTIN.id,
				updatedWithin: 'DAY',
			},
		)
	})

	it('loads the next page of the activity with the cursor', async () => {
		const first = event({ type: ACTIVITY_TYPE.LANGUAGE_ADDED, payload: { tag: 'en' } })
		const second = event({ type: ACTIVITY_TYPE.LANGUAGE_ADDED, payload: { tag: 'cs' } }, hoursAgo(2))
		const requests = signedInAs(
			EDITOR_USER,
			routes({
				[`GET ${API}/activity`]: (config: InternalAxiosRequestConfig) => {
					const params = config.params as { cursor?: string; limit: number }
					return { status: 200, data: params.cursor === first.id ? activityPage([second]) : activityPage([first], first.id) }
				},
			}),
		)
		renderApp(PAGE_PATH)

		const activity = await findActivity()
		expect(await activity.findByText('· pridanie jazyka angličtina', { exact: false })).toBeInTheDocument()
		fireEvent.click(activity.getByRole('button', { name: 'Načítať ďalšie' }))

		expect(await activity.findByText('· pridanie jazyka čeština', { exact: false })).toBeInTheDocument()
		expect(activity.queryByRole('button', { name: 'Načítať ďalšie' })).not.toBeInTheDocument()
		const feedRequests = requests.filter((request) => request.url === `${API}/activity`).map((request) => request.params as unknown)
		expect(feedRequests).toEqual([
			{ cursor: undefined, limit: 10 },
			{ cursor: first.id, limit: 10 },
		])
	})

	it('shows the empty states of a project without keys and activity', async () => {
		signedInAs(
			ADMIN_USER,
			routes({
				[`GET ${API}/dashboard`]: {
					status: 200,
					data: { keys: { total: 0, createdLast30Days: 0 }, translatedKeys: 0, strings: { filled: 0, total: 0 }, baseWords: 0 },
				},
				[`GET ${API}/activity/daily`]: { status: 200, data: { days: DAILY.days.map((day) => ({ ...day, changes: 0 })), contributors: [] } },
			}),
		)
		renderApp(PAGE_PATH)

		expect(await screen.findByText('Zatiaľ žiadne kľúče')).toBeInTheDocument()
		expect(screen.getByRole('link', { name: 'Prejsť na preklady' })).toHaveAttribute('href', `/projects/${PROJECT.slug}/translations`)
		expect(screen.queryByRole('button', { name: /Importovať/ })).not.toBeInTheDocument()
		expect(await (await findActivity()).findByText('Zatiaľ žiadna aktivita. Zmeny v projekte sa zobrazia tu.')).toBeInTheDocument()
		expect(await screen.findByText('V tomto období nikto nič nezmenil.')).toBeInTheDocument()
	})

	it('summarizes the daily activity for screen readers and lists the most active members', async () => {
		signedInAs(EDITOR_USER, routes())
		renderApp(PAGE_PATH)

		const daily = within(await screen.findByRole('region', { name: 'Denná aktivita' }))
		expect(await daily.findByText('Za posledných 30 dní: 6 zmien')).toBeInTheDocument()
		const table = daily.getByRole('table', { name: 'Denná aktivita' })
		expect(within(table).getAllByRole('row').map(text)).toEqual(['DeňZmeny', '18. 10. 20260', '19. 10. 20262', '20. 10. 20264'])
		const contributors = daily.getByRole('list', { name: 'Najaktívnejší členovia' })
		expect(within(contributors).getAllByRole('listitem').map(text)).toEqual(['MKMartin Kováč5 zmien', 'LTLucia Tichá1 zmena'])
	})

	it('refetches the daily activity in the browser time zone when the range changes', async () => {
		const requests = signedInAs(EDITOR_USER, routes())
		renderApp(PAGE_PATH)

		const daily = within(await screen.findByRole('region', { name: 'Denná aktivita' }))
		await daily.findByText('Za posledných 30 dní: 6 zmien')
		fireEvent.click(daily.getByRole('radio', { name: '7 dní' }))

		expect(await daily.findByText('Za posledných 7 dní: 6 zmien')).toBeInTheDocument()
		const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
		const dailyRequests = requests.filter((request) => request.url === `${API}/activity/daily`).map((request) => request.params as unknown)
		expect(dailyRequests).toEqual([
			{ range: '30d', timeZone },
			{ range: '7d', timeZone },
		])
	})

	it('shows a translated error with a retry when the statistics fail', async () => {
		// The global 3 retries with backoff would delay the error state by seconds.
		queryClient.setQueryDefaults(QUERY_KEYS.PROJECTS.DASHBOARD(PROJECT.id), { retry: false })
		let dashboard = apiError(500, 'INTERNAL_ERROR')
		signedInAs(EDITOR_USER, routes({ [`GET ${API}/dashboard`]: () => dashboard }))
		renderApp(PAGE_PATH)

		const alert = await screen.findByRole('alert')
		expect(alert).toHaveTextContent('Štatistiky projektu sa nepodarilo načítať.')
		expect(alert).not.toHaveTextContent('English message that must not be shown')

		dashboard = { status: 200, data: DASHBOARD }
		fireEvent.click(within(alert).getByRole('button', { name: 'Skúsiť znova' }))
		expect(await findCard('Kľúče')).toBeInTheDocument()
	})
})
