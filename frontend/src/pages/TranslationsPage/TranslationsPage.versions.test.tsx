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
import {
	ADMIN_USER,
	CURRENT_VERSION,
	EDITOR_USER,
	type MockRoutes,
	projectListRoute,
	projectVersion,
	signedInAs,
	versionDiff,
	VISITOR_USER,
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

const CURRENT = CURRENT_VERSION
const LOCKED = projectVersion({
	id: '00000000-0000-4000-8000-000000000501',
	name: 'v2.44',
	startsAt: dayShift(-40),
	endsAt: dayShift(-20),
	isLocked: true,
	state: 'LOCKED',
})

const KEY_ID = '00000000-0000-4000-8000-000000000901'

const item = (name: string, target: string | null): TranslationListItem => ({
	keyId: KEY_ID,
	namespace: 'loc',
	name,
	group: translationGroup('loc', name),
	description: null,
	plural: null,
	status: target === null ? 'UNTRANSLATED' : 'TRANSLATED',
	translations: {
		[SLOVAK.id]: { value: 'Vitajte', status: 'TRANSLATED', updatedAt: null, updatedBy: null },
		[ENGLISH.id]: { value: target, status: target === null ? 'UNTRANSLATED' : 'TRANSLATED', updatedAt: null, updatedBy: null },
	},
})

const WELCOME = item('dashboard.welcome', 'Welcome')

/** An upcoming version nobody imported into yet. */
const EMPTY = projectVersion({
	id: '00000000-0000-4000-8000-000000000503',
	name: 'v2.46',
	startsAt: dayShift(13),
	endsAt: dayShift(30),
	isLocked: true,
	state: 'UPCOMING',
	importedAt: null,
	keyCount: 0,
})

const response = (items: TranslationListItem[]): TranslationsResponse => ({
	items,
	total: items.length,
	page: 1,
	pageSize: 20,
	stats: { totalKeys: 10, translated: 8, untranslated: 2, warnings: 0, untranslatedByLanguage: {} },
	namespaces: ['loc'],
	editors: [],
})

const CSV = 'Keys; sk\n--loc--\nUložiť; Uložiť\n'

const PREVIEW: ImportPreviewResponse = {
	columns: [{ tag: 'sk', columnIndex: 2, match: 'PROJECT', languageId: SLOVAK.id, stats: { translations: 1, untranslated: 0, warnings: 0 } }],
	keys: { total: 1, new: 1, existing: 0, copiedFromPrevious: 0 },
	namespaces: [{ namespace: 'loc', keys: 1 }],
	changes: [{ tag: 'sk', columnIndex: 2, new: 1, changed: 0, unchanged: 0, keptBecauseNull: 0 }],
	warnings: [],
	warningsTotal: 0,
	previousVersion: null,
	removed: { total: 0, names: [] },
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
		[`GET ${VERSIONS_URL}/${CURRENT.id}/diff`]: {
			status: 200,
			data: versionDiff({ previousVersion: { id: LOCKED.id, name: LOCKED.name }, added: 4, changed: 1 }),
		},
		[`GET ${VERSIONS_URL}/${LOCKED.id}/diff`]: { status: 200, data: versionDiff({ added: 10 }) },
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
	it('drops the diff filter when the warnings banner shows the keys with a warning', async () => {
		const requests = mockPage({
			routes: {
				[`GET ${TRANSLATIONS_URL}`]: {
					status: 200,
					data: { ...response([WELCOME]), stats: { totalKeys: 10, translated: 8, untranslated: 2, warnings: 1, untranslatedByLanguage: {} } },
				},
			},
		})
		const router = renderApp(`${PAGE_PATH}?diff=true`)
		await findRow('dashboard.welcome')

		fireEvent.click(screen.getByRole('button', { name: 'Zobraziť upozornenia' }))
		await waitFor(() => expect(router.state.location.search).toEqual({ warnings: true }))
		const last = requests.filter((request) => request.url === TRANSLATIONS_URL && paramsOf(request).status !== 'UNTRANSLATED').at(-1)
		expect(paramsOf(last)).toMatchObject({ warnings: true })
		expect(paramsOf(last).diff).toBeUndefined()
	})

	it('clears the warnings filter and hides the banner once no key has a warning', async () => {
		mockPage({
			routes: {
				[`GET ${TRANSLATIONS_URL}`]: (config: InternalAxiosRequestConfig) => ({
					status: 200,
					data: paramsOf(config).warnings ? response([]) : response([WELCOME]),
				}),
			},
		})
		const router = renderApp(`${PAGE_PATH}?warnings=true`)

		await findRow('dashboard.welcome')
		expect(router.state.location.search).toEqual({})
		expect(screen.queryByRole('button', { name: 'Zrušiť filter upozornení' })).not.toBeInTheDocument()
	})

	it('shows the current version by default with its countdown, and another one from the Verzia select', async () => {
		const requests = mockPage()
		const router = renderApp(PAGE_PATH)
		// The banner counts the untranslated keys of the version with its own request; the list requests are the rest.
		const lastListRequest = () => requests.filter((request) => request.url === TRANSLATIONS_URL && paramsOf(request).status !== 'UNTRANSLATED').at(-1)

		await findRow('dashboard.welcome')
		const days = daysUntil(CURRENT.endsAt, TODAY)
		expect(screen.getByText(`Verzia v2.45: ostáva ${days} dní do uzamknutia.`)).toBeInTheDocument()
		expect(router.state.location.search).toEqual({})
		expect(paramsOf(requests.find((request) => request.url === TRANSLATIONS_URL)).versionId).toBe(CURRENT.id)
		expect(screen.getByRole('combobox', { name: 'Verzia' })).toHaveValue('v2.45 (aktuálna)')
		expect(screen.queryByText('Zrušiť filter verzie')).not.toBeInTheDocument()

		await pickOption('Verzia', 'v2.44')
		await waitFor(() => expect(router.state.location.search).toEqual({ version: LOCKED.id }))
		await waitFor(() => expect(paramsOf(lastListRequest()).versionId).toBe(LOCKED.id))
		expect(screen.getByText('Verzia v2.44 je uzamknutá.')).toBeInTheDocument()
	})

	it('falls back to the newest version without a current one, also for an unknown version in the URL', async () => {
		const requests = mockPage({ versions: [LOCKED, projectVersion({ ...LOCKED, id: '00000000-0000-4000-8000-000000000500', name: 'v2.43' })] })
		renderApp(`${PAGE_PATH}?version=00000000-0000-4000-8000-000000000999`)

		await findRow('dashboard.welcome')
		expect(screen.getByRole('combobox', { name: 'Verzia' })).toHaveValue('v2.44')
		expect(paramsOf(requests.find((request) => request.url === TRANSLATIONS_URL)).versionId).toBe(LOCKED.id)
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

	it('shows an empty state instead of the table in a project without versions and asks for no list', async () => {
		const requests = mockPage({ versions: [] })
		renderApp(PAGE_PATH)

		expect(await screen.findByText('Projekt zatiaľ nemá žiadnu verziu. Vytvorte ju a importujte do nej preklady.')).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Vytvoriť verziu' })).toBeInTheDocument()
		expect(screen.queryByRole('table', { name: 'Zoznam prekladov' })).not.toBeInTheDocument()
		expect(screen.queryByRole('button', { name: 'Importovať' })).not.toBeInTheDocument()
		expect(screen.queryByRole('button', { name: 'Exportovať' })).not.toBeInTheDocument()
		expect(screen.queryByRole('combobox', { name: 'Verzia' })).not.toBeInTheDocument()
		expect(requests.filter((request) => request.url === TRANSLATIONS_URL)).toHaveLength(0)
	})

	it('saves a translation of the shown version without a version in the body', async () => {
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
		expect(bodyOf(requests.find((request) => request.method === 'put'))).toEqual({ value: 'Welcome!' })
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

	it('exports the shown version', async () => {
		const requests = mockPage({
			routes: {
				[`GET ${EXPORT_URL}`]: { status: 200, data: new Blob(['Keys; sk \n'], { type: 'text/csv' }) },
				[`GET ${CHECK_URL}`]: { status: 200, data: { warnings: [], total: 0 } },
			},
		})
		renderApp(`${PAGE_PATH}?version=${LOCKED.id}`)
		await findRow('dashboard.welcome')

		fireEvent.click(screen.getByRole('button', { name: 'Exportovať' }))
		const dialog = await screen.findByRole('dialog', { name: 'Exportovať preklady' })
		expect(within(dialog).getByText('Export verzie v2.44')).toBeInTheDocument()
		expect(within(dialog).queryByLabelText('Len zmeny tejto verzie')).not.toBeInTheDocument()
		await waitFor(() => expect(paramsOf(requests.find((request) => request.url === CHECK_URL))).toMatchObject({ versionId: LOCKED.id }))
		expect(paramsOf(requests.find((request) => request.url === CHECK_URL))).not.toHaveProperty('versionScope')

		fireEvent.click(within(dialog).getByRole('button', { name: 'Exportovať CSV' }))

		await waitFor(() => expect(downloads).toEqual(['translations.csv']))
		expect(paramsOf(requests.find((request) => request.url === EXPORT_URL))).toMatchObject({ versionId: LOCKED.id })
		expect(paramsOf(requests.find((request) => request.url === EXPORT_URL))).not.toHaveProperty('versionScope')
	})

	it('imports into the preselected current version, or into the picked one, and previews with it', async () => {
		const requests = mockPage({
			routes: {
				[`POST ${IMPORT_URL}/preview`]: { status: 200, data: PREVIEW },
				[`POST ${IMPORT_URL}`]: {
					status: 200,
					data: {
						keysCreated: 1,
						keysCopied: 0,
						keysRemoved: 0,
						translationsCreated: 1,
						translationsUpdated: 0,
						skippedColumns: 0,
						version: { id: CURRENT.id, name: CURRENT.name },
					},
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
		await runImport('v2.44')

		const bodies = requests.filter((request) => request.method === 'post' && request.url === IMPORT_URL).map(bodyOf)
		expect(bodies[0]).toMatchObject({ versionId: CURRENT.id })
		expect(bodies[1]).toMatchObject({ versionId: LOCKED.id })
		const previews = requests.filter((request) => request.method === 'post' && request.url === `${IMPORT_URL}/preview`).map(bodyOf)
		expect(previews[0]).toMatchObject({ versionId: CURRENT.id })
		expect(previews[1]).toMatchObject({ versionId: LOCKED.id })
		expect(screen.queryByRole('option', { name: 'Bez verzie' })).not.toBeInTheDocument()
	})

	it('preselects the filtered version in the import', async () => {
		mockPage()
		renderApp(`${PAGE_PATH}?version=${LOCKED.id}`)
		await findRow('dashboard.welcome')

		fireEvent.click(screen.getByRole('button', { name: 'Importovať' }))
		const dialog = await screen.findByRole('dialog', { name: 'Importovať preklady' })
		expect(within(dialog).getByRole('combobox', { name: 'Verzia' })).toHaveValue('v2.44')
	})

	it('creates a version from the page, shows it and says when it starts although it is locked for editors', async () => {
		const NEXT = projectVersion({
			id: '00000000-0000-4000-8000-000000000503',
			name: 'v2.46',
			startsAt: dayShift(13),
			endsAt: dayShift(30),
			isLocked: true,
			state: 'UPCOMING',
			importedAt: null,
			keyCount: 0,
		})
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

	it('sums the diff against the previous version up in the banner, or says the version is the first one', async () => {
		mockPage()
		renderApp(PAGE_PATH)
		await findRow('dashboard.welcome')

		expect(await screen.findByText('Oproti v2.44: 4 nové, 1 zmenený, 0 odstránených kľúčov.')).toBeInTheDocument()

		await pickOption('Verzia', 'v2.44')
		expect(await screen.findByText('Prvá verzia projektu.')).toBeInTheDocument()
		expect(screen.queryByText(/Oproti v2.44/)).not.toBeInTheDocument()
	})

	it('shows an empty state inside the card for a version without import and asks for no list or diff', async () => {
		const requests = mockPage({ versions: [EMPTY, CURRENT, LOCKED] })
		renderApp(`${PAGE_PATH}?version=${EMPTY.id}`)

		// The sentence is also in the hidden results region; the empty state is the paragraph in the card.
		const card = (await screen.findAllByText('Verzia v2.46 zatiaľ nemá import. Importujte do nej preklady.'))
			.find((element) => element.tagName === 'P')
			?.closest('div')
		expect(card).toBeDefined()
		expect(within(card as HTMLElement).getByRole('button', { name: 'Importovať' })).toBeInTheDocument()
		expect(screen.getByText(`Verzia v2.46 začína o ${daysUntil(EMPTY.startsAt, TODAY)} dní.`)).toBeInTheDocument()
		expect(screen.getByRole('combobox', { name: 'Verzia' })).toHaveValue('v2.46')
		expect(screen.queryByRole('table', { name: 'Zoznam prekladov' })).not.toBeInTheDocument()
		expect(screen.queryByRole('button', { name: 'Pridať kľúč' })).not.toBeInTheDocument()
		expect(screen.queryByRole('switch', { name: 'Zobraziť len zmeny' })).not.toBeInTheDocument()
		expect(screen.queryByText(/Oproti|Prvá verzia/)).not.toBeInTheDocument()
		expect(requests.filter((request) => request.url === TRANSLATIONS_URL)).toHaveLength(0)
		expect(requests.filter((request) => request.url?.endsWith('/diff'))).toHaveLength(0)

		// The same import modal as the header button opens.
		fireEvent.click(within(card as HTMLElement).getByRole('button', { name: 'Importovať' }))
		const dialog = await screen.findByRole('dialog', { name: 'Importovať preklady' })
		expect(within(dialog).getByRole('combobox', { name: 'Verzia' })).toHaveValue('v2.46')
	})

	it('gives an EDITOR the empty state of a version without import without Importovať', async () => {
		mockPage({ user: EDITOR_USER, versions: [EMPTY, CURRENT, LOCKED] })
		renderApp(`${PAGE_PATH}?version=${EMPTY.id}`)

		await screen.findAllByText('Verzia v2.46 zatiaľ nemá import. Importujte do nej preklady.')
		expect(screen.queryByRole('button', { name: 'Importovať' })).not.toBeInTheDocument()
	})

	it('lists only the changes with Zobraziť len zmeny and marks added keys and changed cells', async () => {
		const ADDED: TranslationListItem = {
			...item('dashboard.new', 'New'),
			keyId: '00000000-0000-4000-8000-000000000902',
			diff: { added: true, changedLanguageIds: [] },
		}
		const CHANGED: TranslationListItem = { ...WELCOME, diff: { added: false, changedLanguageIds: [ENGLISH.id] } }
		const requests = mockPage({
			routes: {
				[`GET ${TRANSLATIONS_URL}`]: (config) => ({
					status: 200,
					data: paramsOf(config).diff === true ? response([ADDED, CHANGED]) : response([WELCOME]),
				}),
			},
		})
		const router = renderApp(`${PAGE_PATH}?page=2`)
		await findRow('dashboard.welcome')
		expect(screen.queryByText('Nový kľúč')).not.toBeInTheDocument()

		fireEvent.click(screen.getByRole('switch', { name: 'Zobraziť len zmeny' }))

		await waitFor(() => expect(router.state.location.search).toEqual({ diff: true }))
		const addedRow = await findRow('dashboard.new')
		expect(within(addedRow).getByText('Nový kľúč')).toBeInTheDocument()
		expect(within(addedRow).getByRole('button', { name: 'Preklad kľúča dashboard.new, angličtina: New' })).not.toHaveAttribute('data-changed')
		const changedRow = await findRow('dashboard.welcome')
		expect(within(changedRow).queryByText('Nový kľúč')).not.toBeInTheDocument()
		expect(within(changedRow).getByRole('button', { name: 'Preklad kľúča dashboard.welcome, angličtina: Zmenené: Welcome' })).toHaveAttribute(
			'data-changed',
			'true',
		)
		expect(within(changedRow).getByRole('button', { name: 'Preklad kľúča dashboard.welcome, slovenčina: Vitajte' })).not.toHaveAttribute('data-changed')
		expect(screen.getByRole('switch', { name: 'Zobraziť len zmeny' })).toBeChecked()
		const diffRequest = requests.find((request) => request.url === TRANSLATIONS_URL && paramsOf(request).diff === true)
		expect(paramsOf(diffRequest)).toMatchObject({ diff: true, versionId: CURRENT.id, page: 1 })

		fireEvent.click(screen.getByRole('switch', { name: 'Zobraziť len zmeny' }))
		await waitFor(() => expect(router.state.location.search).toEqual({}))
	})

	it('marks the changes in the read-only table of a VISITOR too', async () => {
		mockPage({
			user: VISITOR_USER,
			routes: {
				[`GET ${TRANSLATIONS_URL}`]: { status: 200, data: response([{ ...WELCOME, diff: { added: true, changedLanguageIds: [ENGLISH.id] } }]) },
			},
		})
		renderApp(`${PAGE_PATH}?diff=true`)

		const row = await findRow('dashboard.welcome')
		expect(within(row).getByText('Nový kľúč')).toBeInTheDocument()
		expect(within(row).getByText('Preklad kľúča dashboard.welcome, angličtina: Zmenené:').closest('[data-readonly]')).toHaveAttribute(
			'data-changed',
			'true',
		)
	})

	it('shows an EDITOR no Vytvoriť verziu and no lock button', async () => {
		mockPage({ user: EDITOR_USER })
		renderApp(PAGE_PATH)
		await findRow('dashboard.welcome')

		expect(screen.queryByRole('button', { name: 'Vytvoriť verziu' })).not.toBeInTheDocument()
		expect(screen.queryByRole('button', { name: 'Zamknúť verziu v2.45' })).not.toBeInTheDocument()
	})
})
