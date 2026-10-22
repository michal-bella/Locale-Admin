import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { type InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import {
	type ImportPreviewResponse,
	type Language,
	type ProjectSettings,
	type ProjectVersion,
	SUPPORTED_LANGUAGES,
	type TranslationListItem,
	type TranslationsResponse,
	VERSION_LOCK,
	daysUntil,
	toVersionDate,
	translationGroup,
} from '@locale/shared'

import queryClient from '@/api/queryClient'
import { QUERY_KEYS } from '@/api/queryKeys'
import { ADMIN_USER, EDITOR_USER, type MockRoutes, projectListRoute, signedInAs } from '@/test/mockApi'
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
const VERSIONS_URL = `/projects/${PROJECT.id}/versions`
const EXPORT_URL = `/projects/${PROJECT.id}/export`
const CHECK_URL = `/projects/${PROJECT.id}/export/check`
const IMPORT_URL = `/projects/${PROJECT.id}/imports`

const TODAY = toVersionDate(new Date())
const dayShift = (days: number) => toVersionDate(new Date(Date.now() + days * 86_400_000))

const version = (overrides: Partial<ProjectVersion> & Pick<ProjectVersion, 'id' | 'name'>): ProjectVersion => ({
	startsAt: dayShift(-5),
	endsAt: dayShift(12),
	lock: VERSION_LOCK.AUTO,
	isLocked: false,
	state: 'ACTIVE',
	isCurrent: false,
	createdAt: '2026-09-01T10:00:00.000Z',
	createdBy: null,
	...overrides,
})

const CURRENT = version({ id: '00000000-0000-4000-8000-000000000502', name: 'v2.45', isCurrent: true })
const LOCKED = version({
	id: '00000000-0000-4000-8000-000000000501',
	name: 'v2.44',
	startsAt: dayShift(-40),
	endsAt: dayShift(-20),
	isLocked: true,
	state: 'LOCKED',
})

const KEY_ID = '00000000-0000-4000-8000-000000000901'

const item = (name: string, versionRef: TranslationListItem['version'], target: string | null): TranslationListItem => ({
	keyId: KEY_ID,
	namespace: 'loc',
	name,
	group: translationGroup('loc', name),
	description: null,
	plural: null,
	version: versionRef,
	status: target === null ? 'UNTRANSLATED' : 'TRANSLATED',
	translations: {
		[SLOVAK.id]: { value: 'Vitajte', status: 'TRANSLATED', updatedAt: null, updatedBy: null },
		[ENGLISH.id]: { value: target, status: target === null ? 'UNTRANSLATED' : 'TRANSLATED', updatedAt: null, updatedBy: null },
	},
})

const WELCOME = item('dashboard.welcome', { id: CURRENT.id, name: CURRENT.name }, 'Welcome')

const response = (items: TranslationListItem[]): TranslationsResponse => ({
	items,
	total: items.length,
	page: 1,
	pageSize: 20,
	stats: { totalKeys: 10, translated: 8, untranslated: 2, warnings: 0 },
	namespaces: ['loc'],
	editors: [],
})

const CSV = 'Keys; sk\n--loc--\nUložiť; Uložiť\n'

const PREVIEW: ImportPreviewResponse = {
	columns: [{ tag: 'sk', columnIndex: 2, match: 'PROJECT', languageId: SLOVAK.id, stats: { translations: 1, untranslated: 0, warnings: 0 } }],
	keys: { total: 1, new: 1, existing: 0 },
	namespaces: [{ namespace: 'loc', keys: 1 }],
	changes: [{ tag: 'sk', columnIndex: 2, new: 1, changed: 0, unchanged: 0, keptBecauseNull: 0 }],
	warnings: [],
	warningsTotal: 0,
}

const mockPage = ({
	user = ADMIN_USER,
	versions = [CURRENT, LOCKED],
	routes = {},
}: { user?: typeof ADMIN_USER; versions?: ProjectVersion[]; routes?: MockRoutes } = {}) =>
	signedInAs(user, {
		...projectListRoute(PROJECT),
		[`GET /projects/${PROJECT.id}/settings`]: { status: 200, data: PROJECT },
		[`GET /projects/${PROJECT.id}/languages`]: { status: 200, data: [SLOVAK, ENGLISH] },
		[`GET ${VERSIONS_URL}`]: { status: 200, data: { items: versions } },
		[`GET ${TRANSLATIONS_URL}`]: { status: 200, data: response([WELCOME]) },
		...routes,
	})

const bodyOf = (request: InternalAxiosRequestConfig | undefined) => JSON.parse(request?.data as string) as unknown

const paramsOf = (request: InternalAxiosRequestConfig | undefined) => request?.params as Record<string, unknown>

const pickOption = async (label: string, option: string) => {
	fireEvent.click(screen.getByRole('combobox', { name: label }))
	fireEvent.click(await screen.findByRole('option', { name: option }))
}

const findRow = async (key: string) => {
	const row = (await within(await screen.findByRole('table', { name: 'Zoznam prekladov' })).findByText(key)).closest('tr')
	if (!row) {
		throw new Error(`Row ${key} not found`)
	}
	return row
}

let downloads: string[] = []

beforeAll(() => {
	queryClient.setQueryDefaults(QUERY_KEYS.PROJECTS.DETAIL(PROJECT.id), { retry: false })
})

beforeEach(() => {
	downloads = []
	// jsdom has no object URLs and does not navigate on click; the click records the file name the browser would save.
	URL.createObjectURL = vi.fn(() => 'blob:export')
	URL.revokeObjectURL = vi.fn()
	vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
		downloads.push(this.download)
	})
})

afterEach(() => {
	vi.restoreAllMocks()
})

describe('TranslationsPage versions', () => {
	it('shows the work of the current version by default, the whole project after clearing, and the chip and countdown', async () => {
		const requests = mockPage()
		const router = renderApp(PAGE_PATH)
		// The banner counts the untranslated keys of the version with its own request; the list requests are the rest.
		const lastListRequest = () => requests.filter((request) => request.url === TRANSLATIONS_URL && paramsOf(request).status !== 'UNTRANSLATED').at(-1)

		const row = await findRow('dashboard.welcome')
		expect(within(row).getByText('v2.45')).toHaveAccessibleName('Vznikol vo verzii v2.45')
		const days = daysUntil(CURRENT.endsAt, TODAY)
		expect(screen.getByText(`Verzia v2.45: ostáva ${days} dní do uzamknutia.`)).toBeInTheDocument()
		expect(router.state.location.search).toEqual({})
		expect(paramsOf(requests.find((request) => request.url === TRANSLATIONS_URL)).versionId).toBe(CURRENT.id)
		expect(screen.getByRole('combobox', { name: 'Verzia' })).toHaveValue('v2.45 (aktuálna)')

		fireEvent.click(screen.getByRole('button', { name: 'Zrušiť filter verzie' }))
		await waitFor(() => expect(router.state.location.search).toEqual({ version: 'ALL' }))
		await waitFor(() => expect(paramsOf(lastListRequest()).versionId).toBeUndefined())
		expect(screen.getByRole('combobox', { name: 'Verzia' })).toHaveValue('')
		expect(screen.queryByRole('button', { name: 'Zrušiť filter verzie' })).not.toBeInTheDocument()

		await pickOption('Verzia', 'v2.45 (aktuálna)')
		await waitFor(() => expect(router.state.location.search).toEqual({ version: CURRENT.id }))
		await waitFor(() => expect(paramsOf(lastListRequest()).versionId).toBe(CURRENT.id))
	})

	it('says how many keys of the version are still untranslated', async () => {
		const requests = mockPage({
			routes: {
				[`GET ${TRANSLATIONS_URL}`]: (config) => ({
					status: 200,
					data:
						paramsOf(config).versionId === CURRENT.id && paramsOf(config).status === 'UNTRANSLATED'
							? { ...response([]), total: 3 }
							: response([WELCOME]),
				}),
			},
		})
		renderApp(PAGE_PATH)
		await findRow('dashboard.welcome')

		expect(await screen.findByText('Nepreložené ostávajú 3 kľúče.')).toBeInTheDocument()
		const countRequest = requests.find((request) => request.url === TRANSLATIONS_URL && paramsOf(request).status === 'UNTRANSLATED')
		expect(paramsOf(countRequest)).toMatchObject({ versionId: CURRENT.id, pageSize: 1 })
	})

	it('shows no filter and no banner in a project without versions', async () => {
		mockPage({ versions: [] })
		renderApp(PAGE_PATH)

		await findRow('dashboard.welcome')
		expect(screen.queryByRole('combobox', { name: 'Verzia' })).not.toBeInTheDocument()
		expect(screen.queryByText(/do uzamknutia/)).not.toBeInTheDocument()
	})

	it('sends the filtered version with a saved translation', async () => {
		const requests = mockPage({
			routes: {
				[`PUT ${TRANSLATIONS_URL.replace('/translations', '')}/keys/${KEY_ID}/translations/${ENGLISH.id}`]: () => ({
					status: 200,
					data: { value: 'Welcome!', status: 'TRANSLATED', updatedAt: null, updatedBy: null },
				}),
			},
		})
		renderApp(`${PAGE_PATH}?version=${CURRENT.id}`)

		const row = await findRow('dashboard.welcome')
		const cell = within(row).getByRole('button', { name: 'Preklad kľúča dashboard.welcome, angličtina: Welcome' })
		act(() => cell.focus())
		fireEvent.click(cell)
		const dialog = await screen.findByRole('dialog', { name: 'Upraviť preklad' })
		const field = within(dialog).getByRole('textbox', { name: 'Preklad kľúča dashboard.welcome, angličtina' })
		act(() => field.focus())
		field.textContent = 'Welcome!'
		fireEvent.input(field)
		fireEvent.click(within(dialog).getByRole('button', { name: 'Uložiť' }))

		await waitFor(() => expect(requests.filter((request) => request.method === 'put')).toHaveLength(1))
		expect(bodyOf(requests.find((request) => request.method === 'put'))).toEqual({ value: 'Welcome!', versionId: CURRENT.id })
	})

	it('keeps the cells of a locked version read-only for an EDITOR and says why', async () => {
		mockPage({ user: EDITOR_USER })
		renderApp(`${PAGE_PATH}?version=${LOCKED.id}`)

		const row = await findRow('dashboard.welcome')
		expect(screen.getByText('Verzia v2.44 je uzamknutá, jej preklady upravuje už len administrátor.')).toBeInTheDocument()
		expect(within(row).queryByRole('button', { name: /Preklad kľúča dashboard.welcome, angličtina/ })).not.toBeInTheDocument()
	})

	it('lets an ADMIN edit in a locked version', async () => {
		mockPage()
		renderApp(`${PAGE_PATH}?version=${LOCKED.id}`)

		const row = await findRow('dashboard.welcome')
		expect(screen.getByText('Verzia v2.44 je uzamknutá.')).toBeInTheDocument()
		expect(within(row).getByRole('button', { name: /Preklad kľúča dashboard.welcome, angličtina/ })).toBeInTheDocument()
	})

	it('exports the project as of the filtered version, or only its work with the checkbox', async () => {
		const requests = mockPage({
			routes: {
				[`GET ${EXPORT_URL}`]: { status: 200, data: new Blob(['Keys; sk \n'], { type: 'text/csv' }) },
				[`GET ${CHECK_URL}`]: { status: 200, data: { warnings: [], total: 0 } },
			},
		})
		renderApp(`${PAGE_PATH}?version=${CURRENT.id}`)
		await findRow('dashboard.welcome')

		fireEvent.click(screen.getByRole('button', { name: 'Exportovať' }))
		const dialog = await screen.findByRole('dialog', { name: 'Exportovať preklady' })
		expect(within(dialog).getByText('Stav projektu k verzii v2.45')).toBeInTheDocument()
		await waitFor(() =>
			expect(paramsOf(requests.find((request) => request.url === CHECK_URL))).toMatchObject({ versionId: CURRENT.id, versionScope: 'UP_TO' }),
		)

		fireEvent.click(within(dialog).getByLabelText('Len zmeny tejto verzie'))
		fireEvent.click(within(dialog).getByRole('button', { name: 'Exportovať CSV' }))

		await waitFor(() => expect(downloads).toEqual(['translations.csv']))
		expect(paramsOf(requests.find((request) => request.url === EXPORT_URL))).toMatchObject({ versionId: CURRENT.id, versionScope: 'ONLY' })
	})

	it('imports into the preselected current version, or without one', async () => {
		const requests = mockPage({
			routes: {
				[`POST ${IMPORT_URL}/preview`]: { status: 200, data: PREVIEW },
				[`POST ${IMPORT_URL}`]: {
					status: 200,
					data: { keysCreated: 1, translationsCreated: 1, translationsUpdated: 0, skippedColumns: 0, version: null },
				},
			},
		})
		renderApp(PAGE_PATH)
		await findRow('dashboard.welcome')

		const runImport = async (option?: string) => {
			fireEvent.click(screen.getByRole('button', { name: 'Importovať' }))
			const dialog = await screen.findByRole('dialog', { name: 'Importovať preklady' })
			if (option) {
				fireEvent.click(within(dialog).getByRole('combobox', { name: 'Verzia' }))
				fireEvent.click(await screen.findByRole('option', { name: option }))
			}
			fireEvent.change(within(dialog).getByLabelText('Súbor s prekladmi'), { target: { files: [new File([CSV], 'preklady.csv', { type: 'text/csv' })] } })
			await within(dialog).findByText('preklady.csv')
			fireEvent.click(within(dialog).getByRole('button', { name: 'Pokračovať na kontrolu' }))
			await within(dialog).findByRole('table', { name: 'Stĺpce jazykov v súbore' })
			fireEvent.click(within(dialog).getByRole('button', { name: 'Importovať' }))
			await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Importovať preklady' })).not.toBeInTheDocument())
		}

		await runImport()
		await runImport('Bez verzie')

		const bodies = requests.filter((request) => request.method === 'post' && request.url === IMPORT_URL).map(bodyOf)
		expect(bodies[0]).toMatchObject({ versionId: CURRENT.id })
		expect(bodies[1]).not.toHaveProperty('versionId')
	})

	it('preselects the filtered version in the import', async () => {
		mockPage()
		renderApp(`${PAGE_PATH}?version=${LOCKED.id}`)
		await findRow('dashboard.welcome')

		fireEvent.click(screen.getByRole('button', { name: 'Importovať' }))
		const dialog = await screen.findByRole('dialog', { name: 'Importovať preklady' })
		expect(within(dialog).getByRole('combobox', { name: 'Verzia' })).toHaveValue('v2.44')
	})

	it('creates a version from the page and filters by it', async () => {
		const NEXT = version({ id: '00000000-0000-4000-8000-000000000503', name: 'v2.46', startsAt: dayShift(13), endsAt: dayShift(30), state: 'UPCOMING' })
		let created = false
		const requests = mockPage({
			routes: {
				[`GET ${VERSIONS_URL}`]: () => ({ status: 200, data: { items: created ? [NEXT, CURRENT, LOCKED] : [CURRENT, LOCKED] } }),
				[`POST ${VERSIONS_URL}`]: () => {
					created = true
					return { status: 201, data: NEXT }
				},
			},
		})
		const router = renderApp(PAGE_PATH)
		await findRow('dashboard.welcome')

		fireEvent.click(screen.getByRole('button', { name: 'Vytvoriť verziu' }))
		const dialog = await screen.findByRole('dialog', { name: 'Vytvoriť verziu' })
		fireEvent.change(within(dialog).getByLabelText('Názov verzie'), { target: { value: NEXT.name } })
		fireEvent.change(within(dialog).getByLabelText('Začiatok'), { target: { value: NEXT.startsAt } })
		fireEvent.change(within(dialog).getByLabelText('Koniec'), { target: { value: NEXT.endsAt } })
		fireEvent.click(within(dialog).getByRole('button', { name: 'Vytvoriť' }))

		await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Vytvoriť verziu' })).not.toBeInTheDocument())
		expect(bodyOf(requests.find((request) => request.method === 'post' && request.url === VERSIONS_URL))).toEqual({
			name: NEXT.name,
			startsAt: NEXT.startsAt,
			endsAt: NEXT.endsAt,
		})
		await waitFor(() => expect(router.state.location.search).toEqual({ version: NEXT.id }))
		expect(await screen.findByRole('combobox', { name: 'Verzia' })).toHaveValue('v2.46')
		expect(await screen.findByText(`Verzia v2.46 začína o ${daysUntil(NEXT.startsAt, TODAY)} dní.`)).toBeInTheDocument()
	})

	it('lets an ADMIN lock and unlock the version of the banner', async () => {
		let lock: string | undefined
		const requests = mockPage({
			routes: {
				[`GET ${VERSIONS_URL}`]: () => ({
					status: 200,
					data: { items: [lock === 'LOCKED' ? { ...CURRENT, lock: VERSION_LOCK.LOCKED, isLocked: true, state: 'LOCKED' } : CURRENT, LOCKED] },
				}),
				[`PATCH ${VERSIONS_URL}/${CURRENT.id}`]: () => ({ status: 200, data: { ...CURRENT, lock, isLocked: lock === 'LOCKED' } }),
			},
		})
		renderApp(PAGE_PATH)
		await findRow('dashboard.welcome')

		fireEvent.click(await screen.findByRole('button', { name: 'Zamknúť verziu v2.45' }))
		const lockDialog = await screen.findByRole('dialog', { name: 'Zamknúť verziu' })
		lock = 'LOCKED'
		fireEvent.click(within(lockDialog).getByRole('button', { name: 'Zamknúť' }))
		await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Zamknúť verziu' })).not.toBeInTheDocument())
		expect(bodyOf(requests.find((request) => request.method === 'patch'))).toEqual({ lock: 'LOCKED' })
		expect(await screen.findByText('Verzia v2.45 je uzamknutá.')).toBeInTheDocument()

		fireEvent.click(await screen.findByRole('button', { name: 'Odomknúť verziu v2.45' }))
		const unlockDialog = await screen.findByRole('dialog', { name: 'Odomknúť verziu' })
		lock = 'UNLOCKED'
		fireEvent.click(within(unlockDialog).getByRole('button', { name: 'Odomknúť' }))
		await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Odomknúť verziu' })).not.toBeInTheDocument())
		expect(bodyOf(requests.filter((request) => request.method === 'patch').at(-1))).toEqual({ lock: 'UNLOCKED' })
	})

	it('shows an EDITOR no Vytvoriť verziu and no lock button', async () => {
		mockPage({ user: EDITOR_USER })
		renderApp(PAGE_PATH)
		await findRow('dashboard.welcome')

		expect(screen.queryByRole('button', { name: 'Vytvoriť verziu' })).not.toBeInTheDocument()
		expect(screen.queryByRole('button', { name: 'Zamknúť verziu v2.45' })).not.toBeInTheDocument()
	})
})
