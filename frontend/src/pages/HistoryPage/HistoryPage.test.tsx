import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { type InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { ACTIVITY_TYPE, type ActivityEvent, type ActivityListResponse, type ProjectSettings } from '@locale/shared'

import queryClient from '@/api/queryClient'
import { QUERY_KEYS } from '@/api/queryKeys'
import { apiError, EDITOR_USER, type MockRoutes, projectListRoute, projectVersion, signedInAs } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'

const PROJECT: ProjectSettings = {
	id: '00000000-0000-4000-8000-000000000301',
	name: 'Booking Web',
	slug: 'booking-web',
	primaryColor: '#E83E8C',
	protectVariables: true,
	baseLanguageId: null,
}

const PAGE_PATH = `/projects/${PROJECT.slug}/history`
const API = `/projects/${PROJECT.id}`

const NOW = new Date(2026, 9, 20, 12, 0, 0)

const CURRENT = projectVersion({ id: '00000000-0000-4000-8000-000000000502', name: 'v2.45', isCurrent: true })

const MARTIN = { id: '00000000-0000-4000-8000-000000000201', name: 'Martin Kováč' }
const LUCIA = { id: '00000000-0000-4000-8000-000000000202', name: 'Lucia Tichá' }

const EDIT: ActivityEvent = {
	id: '00000000-0000-4000-8000-000000000401',
	createdAt: new Date(2026, 9, 20, 11, 0).toISOString(),
	count: 1,
	user: MARTIN,
	version: { id: CURRENT.id, name: CURRENT.name },
	type: ACTIVITY_TYPE.TRANSLATION_UPDATED,
	payload: { keyId: '00000000-0000-4000-8000-000000000601', namespace: 'loc', name: 'orders.title', languageTag: 'en', oldValue: null, newValue: 'Orders' },
}

const LANGUAGE: ActivityEvent = {
	id: '00000000-0000-4000-8000-000000000402',
	createdAt: new Date(2026, 9, 18, 9, 30).toISOString(),
	count: 1,
	user: null,
	version: null,
	type: ACTIVITY_TYPE.LANGUAGE_ADDED,
	payload: { tag: 'cs' },
}

const page = (items: ActivityEvent[], total = items.length, pageSize = 20): ActivityListResponse => ({
	items,
	total,
	page: 1,
	pageSize,
	users: [LUCIA, MARTIN],
})

const routes = (overrides: MockRoutes = {}): MockRoutes => ({
	...projectListRoute(PROJECT),
	[`GET ${API}/settings`]: { status: 200, data: PROJECT },
	[`GET ${API}/versions`]: { status: 200, data: { items: [CURRENT] } },
	[`GET ${API}/activity`]: { status: 200, data: page([EDIT, LANGUAGE]) },
	...overrides,
})

const activityParams = (requests: InternalAxiosRequestConfig[]) =>
	requests.filter((request) => request.url === `${API}/activity`).map((request) => request.params as Record<string, unknown>)

const findTable = async () => within(await screen.findByRole('table', { name: 'História zmien projektu' }))

describe('HistoryPage', () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['Date'] })
		vi.setSystemTime(NOW)
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it('lists the events with who, type, change and version, and links an edit to its translation', async () => {
		signedInAs(EDITOR_USER, routes())
		renderApp(PAGE_PATH)

		const table = await findTable()
		await table.findByText('pridanie jazyka čeština')
		const rows = table.getAllByRole('row')
		expect(rows).toHaveLength(3)
		const edit = within(rows[1] as HTMLElement)
		expect(edit.getAllByText('Martin Kováč')[0]).toBeInTheDocument()
		expect(edit.getAllByText('Preklad')[0]).toBeInTheDocument()
		expect(edit.getByText('úprava prekladu orders.title (angličtina)')).toBeInTheDocument()
		expect(edit.getAllByText('v2.45')[0]).toBeInTheDocument()
		expect(edit.getByRole('link', { name: 'Zobraziť preklad orders.title v prekladoch' })).toBeInTheDocument()
		const language = within(rows[2] as HTMLElement)
		expect(language.getAllByText('Odstránený používateľ')[0]).toBeInTheDocument()
		expect(language.getByText('pridanie jazyka čeština')).toBeInTheDocument()
		expect(language.queryByRole('link')).not.toBeInTheDocument()
		expect(screen.getByText('Zobrazené 2 z 2 zmien')).toBeInTheDocument()
	})

	it('sends the filters of the URL with the period as local day bounds, the last day included', async () => {
		const requests = signedInAs(EDITOR_USER, routes())
		renderApp(`${PAGE_PATH}?user=${MARTIN.id}&category=TRANSLATION&version=${CURRENT.id}&from=2026-10-01&to=2026-10-07&page=2&pageSize=50`)

		await findTable()
		await waitFor(() =>
			expect(activityParams(requests)).toEqual([
				{
					userId: MARTIN.id,
					category: 'TRANSLATION',
					versionId: CURRENT.id,
					from: new Date(2026, 9, 1).toISOString(),
					to: new Date(2026, 9, 8).toISOString(),
					page: 2,
					pageSize: 50,
				},
			]),
		)
	})

	it('filters by a chosen type from the first page and clears the filters', async () => {
		const requests = signedInAs(EDITOR_USER, routes())
		const router = renderApp(`${PAGE_PATH}?page=2`)

		fireEvent.click(await screen.findByLabelText('Typ zmeny', { selector: 'input' }))
		fireEvent.click(await screen.findByRole('option', { name: 'Import' }))

		await waitFor(() => expect(router.state.location.search).toEqual({ category: 'IMPORT' }))
		await waitFor(() => expect(activityParams(requests).at(-1)).toMatchObject({ category: 'IMPORT', page: 1 }))
		fireEvent.click(screen.getByRole('button', { name: 'Zrušiť filtre' }))
		await waitFor(() => expect(router.state.location.search).toEqual({}))
	})

	it('offers the people of the project in the person filter', async () => {
		signedInAs(EDITOR_USER, routes())
		renderApp(PAGE_PATH)

		await findTable()
		fireEvent.click(screen.getByLabelText('Kto', { selector: 'input' }))
		expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual(['Lucia Tichá', 'Martin Kováč'])
	})

	it('moves between numbered pages', async () => {
		const requests = signedInAs(EDITOR_USER, routes({ [`GET ${API}/activity`]: { status: 200, data: page([EDIT], 45) } }))
		const router = renderApp(PAGE_PATH)

		await findTable()
		fireEvent.click(await screen.findByRole('button', { name: 'Strana 3' }))

		await waitFor(() => expect(router.state.location.search).toEqual({ page: 3 }))
		await waitFor(() => expect(activityParams(requests).at(-1)).toMatchObject({ page: 3, pageSize: 20 }))
	})

	it('says no change matches the filters, without the pagination', async () => {
		signedInAs(EDITOR_USER, routes({ [`GET ${API}/activity`]: { status: 200, data: page([]) } }))
		renderApp(`${PAGE_PATH}?category=MEMBER`)

		const table = await findTable()
		expect(await table.findByText('Filtrom nezodpovedá žiadna zmena.')).toBeInTheDocument()
		expect(screen.queryByText(/Zobrazených/)).not.toBeInTheDocument()
	})

	it('shows the error code and retries', async () => {
		// The global 3 retries with backoff would delay the error state by seconds.
		queryClient.setQueryDefaults(QUERY_KEYS.PROJECTS.ACTIVITY_ALL(PROJECT.id), { retry: false })
		let calls = 0
		signedInAs(
			EDITOR_USER,
			routes({
				[`GET ${API}/activity`]: () => {
					calls += 1
					return calls === 1 ? apiError(500, 'INTERNAL_ERROR') : { status: 200, data: page([LANGUAGE]) }
				},
			}),
		)
		renderApp(PAGE_PATH)

		const table = await findTable()
		expect(await table.findByText('Históriu sa nepodarilo načítať.')).toBeInTheDocument()
		fireEvent.click(table.getByRole('button', { name: 'Skúsiť znova' }))
		expect(await table.findByText('pridanie jazyka čeština')).toBeInTheDocument()
	})
})
