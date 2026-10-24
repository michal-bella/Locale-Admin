import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { type InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { ACTIVITY_TYPE, type ActivityEvent, type ActivityListResponse, type ProjectSettings } from '@locale/shared'

import queryClient from '@/api/queryClient'
import { QUERY_KEYS } from '@/api/queryKeys'
import { ADMIN_USER, apiError, EDITOR_USER, VISITOR_USER, type MockRoutes, projectListRoute, projectVersion, signedInAs } from '@/test/mockApi'
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

	it('opens the old and new value of a translation edit from Zobraziť zmenu, only on translation rows', async () => {
		signedInAs(VISITOR_USER, routes())
		renderApp(PAGE_PATH)

		const table = await findTable()
		await table.findByText('pridanie jazyka čeština')
		const rows = table.getAllByRole('row')
		expect(within(rows[2] as HTMLElement).queryByRole('button', { name: /^Zobraziť zmenu/ })).not.toBeInTheDocument()

		fireEvent.click(within(rows[1] as HTMLElement).getByRole('button', { name: 'Zobraziť zmenu prekladu orders.title (angličtina)' }))
		const dialog = within(await screen.findByRole('dialog', { name: 'Zmena prekladu' }))
		expect(screen.getByRole('dialog', { name: 'Zmena prekladu' }).querySelector('header code')).toHaveTextContent('loc:orders.title')
		expect(dialog.getByText('Nepreložené')).toBeInTheDocument()
		expect(dialog.getByText('Orders').closest('ins')).not.toBeNull()

		fireEvent.click(dialog.getAllByRole('button', { name: 'Zavrieť' })[0] as HTMLElement)
		await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Zmena prekladu' })).not.toBeInTheDocument())
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

	it.each([
		['an ADMIN', ADMIN_USER, true],
		['an EDITOR', EDITOR_USER, false],
		['a VISITOR', VISITOR_USER, false],
	])('links a version event to its translations and, for %s, a key event to the key', async (_, user, keyLinks) => {
		const event = (id: number, data: Pick<ActivityEvent, 'type' | 'payload'>, version: ActivityEvent['version']): ActivityEvent =>
			({ ...LANGUAGE, id: `00000000-0000-4000-8000-0000000004${id}`, user: MARTIN, version, ...data }) as ActivityEvent
		const v245 = { id: CURRENT.id, name: CURRENT.name }
		const keyId = '00000000-0000-4000-8000-000000000601'
		signedInAs(
			user,
			routes({
				[`GET ${API}/activity`]: {
					status: 200,
					data: page([
						event(11, { type: ACTIVITY_TYPE.KEY_CREATED, payload: { keyId, namespace: 'loc', name: 'orders.empty', languageTags: ['sk'] } }, v245),
						event(
							12,
							{ type: ACTIVITY_TYPE.KEY_UPDATED, payload: { keyId, namespace: 'loc', name: 'orders.title', fields: ['description'] } },
							v245,
						),
						event(13, { type: ACTIVITY_TYPE.VERSION_CREATED, payload: { name: 'v2.45', startsAt: '2026-10-01', endsAt: '2026-10-31' } }, v245),
						event(14, { type: ACTIVITY_TYPE.VERSION_DELETED, payload: { name: 'v2.44', keyCount: 3 } }, null),
					]),
				},
			}),
		)
		renderApp(PAGE_PATH)

		const table = await findTable()
		await table.findByText('nový kľúč orders.empty')
		const hrefOf = (link: Element | null | undefined) =>
			link ? Object.fromEntries(new URL(link.getAttribute('href') ?? '', 'http://localhost').searchParams) : null
		const rows = table.getAllByRole('row').slice(1)
		// The → in the last cell of each row.
		expect(rows.map((row) => hrefOf(row.lastElementChild?.querySelector('a')))).toEqual([
			keyLinks ? { search: 'orders.empty', namespace: 'loc', version: CURRENT.id } : null,
			keyLinks ? { search: 'orders.title', namespace: 'loc', version: CURRENT.id } : null,
			{ version: CURRENT.id },
			null,
		])
		// The Verzia cell links to the translations of that version for everyone; a deleted version is a dash.
		const versionCells = rows.map((row) => row.children[4])
		expect(versionCells.map((cell) => hrefOf(cell?.querySelector('a')))).toEqual([
			{ version: CURRENT.id },
			{ version: CURRENT.id },
			{ version: CURRENT.id },
			null,
		])
		expect(within(versionCells[0] as HTMLElement).getByRole('link')).toHaveAccessibleName('Zobraziť preklady verzie v2.45')
		expect(versionCells[3]).toHaveTextContent('–')
	})

	it('sends the filters of the URL with the period from the start of the first local day, today included', async () => {
		const requests = signedInAs(EDITOR_USER, routes())
		renderApp(`${PAGE_PATH}?user=${MARTIN.id}&category=TRANSLATION&version=${CURRENT.id}&period=7d&page=2&pageSize=50`)

		await findTable()
		await waitFor(() =>
			expect(activityParams(requests)).toEqual([
				{
					userId: MARTIN.id,
					category: 'TRANSLATION',
					versionId: CURRENT.id,
					// NOW is 20. 10. 2026, so the 7 days start on 14. 10.
					from: new Date(2026, 9, 14).toISOString(),
					page: 2,
					pageSize: 50,
				},
			]),
		)
	})

	it('filters by a chosen type from the first page, without a Zrušiť filtre above the table', async () => {
		const requests = signedInAs(EDITOR_USER, routes())
		const router = renderApp(`${PAGE_PATH}?page=2`)

		fireEvent.click(await screen.findByLabelText('Typ zmeny', { selector: 'input' }))
		fireEvent.click(await screen.findByRole('option', { name: 'Import' }))

		await waitFor(() => expect(router.state.location.search).toEqual({ category: 'IMPORT' }))
		await waitFor(() => expect(activityParams(requests).at(-1)).toMatchObject({ category: 'IMPORT', page: 1 }))
		expect(screen.queryByRole('button', { name: 'Zrušiť filtre' })).not.toBeInTheDocument()
	})

	it('shows only my changes with the switch, in sync with the person filter, and offers me even without a change', async () => {
		const requests = signedInAs(EDITOR_USER, routes())
		const router = renderApp(PAGE_PATH)

		const mine = await screen.findByRole('switch', { name: 'Len moje zmeny' })
		expect(mine).not.toBeChecked()
		fireEvent.click(mine)

		await waitFor(() => expect(router.state.location.search).toEqual({ user: EDITOR_USER.id }))
		await waitFor(() => expect(activityParams(requests).at(-1)).toMatchObject({ userId: EDITOR_USER.id }))
		expect(mine).toBeChecked()
		// EDITOR_USER has no event in `users` and no name, the person filter shows the e-mail.
		expect(screen.getByLabelText('Kto', { selector: 'input' })).toHaveValue(EDITOR_USER.email)

		fireEvent.click(mine)
		await waitFor(() => expect(router.state.location.search).toEqual({}))
	})

	it('unchecks Len moje zmeny when the person filter picks someone else', async () => {
		signedInAs(EDITOR_USER, routes())
		renderApp(`${PAGE_PATH}?user=${EDITOR_USER.id}`)

		expect(await screen.findByRole('switch', { name: 'Len moje zmeny' })).toBeChecked()
		fireEvent.click(screen.getByLabelText('Kto', { selector: 'input' }))
		fireEvent.click(await screen.findByRole('option', { name: 'Lucia Tichá' }))

		await waitFor(() => expect(screen.getByRole('switch', { name: 'Len moje zmeny' })).not.toBeChecked())
	})

	it('picks a period from the select and goes back to Celé obdobie without a from', async () => {
		const requests = signedInAs(EDITOR_USER, routes())
		const router = renderApp(PAGE_PATH)

		const period = await screen.findByLabelText('Obdobie', { selector: 'input' })
		expect(period).toHaveValue('Celé obdobie')
		fireEvent.click(period)
		expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual([
			'Celé obdobie',
			'Posledných 7 dní',
			'Posledných 30 dní',
			'Posledných 90 dní',
		])
		fireEvent.click(screen.getByRole('option', { name: 'Posledných 30 dní' }))

		await waitFor(() => expect(router.state.location.search).toEqual({ period: '30d' }))
		await waitFor(() => expect(activityParams(requests).at(-1)).toMatchObject({ from: new Date(2026, 8, 21).toISOString() }))
		fireEvent.click(screen.getByLabelText('Obdobie', { selector: 'input' }))
		fireEvent.click(await screen.findByRole('option', { name: 'Celé obdobie' }))
		await waitFor(() => expect(router.state.location.search).toEqual({}))
		await waitFor(() => expect(activityParams(requests).at(-1)?.from).toBeUndefined())
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
