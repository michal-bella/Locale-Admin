import { notifications } from '@mantine/notifications'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import Sortable from 'sortablejs'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vite-plus/test'

import { PROJECT_ROLE, type ProjectListItem, type ProjectSettings, ROLE, SUPPORTED_LANGUAGES } from '@locale/shared'

import queryClient from '@/api/queryClient'
import { QUERY_KEYS } from '@/api/queryKeys'
import { ADMIN_USER, apiError, EDITOR_USER, signedInAs, VISITOR_USER } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'

const BOOKING: ProjectListItem = {
	id: '00000000-0000-4000-8000-000000000401',
	name: 'Booking Web',
	slug: 'booking-web',
	primaryColor: '#FACC15',
	isMember: true,
	myRole: PROJECT_ROLE.EDITOR,
	languageTags: ['en', 'sk'],
	keyCount: 224,
	translatedCount: 447,
	memberCount: 3,
	createdAt: '2026-10-12T08:00:00.000Z',
}

const DEMO: ProjectListItem = {
	id: '00000000-0000-4000-8000-000000000402',
	name: 'Demo project',
	slug: 'demo-project',
	primaryColor: '#1D4ED8',
	isMember: false,
	myRole: ROLE.ADMIN,
	languageTags: [],
	keyCount: 0,
	translatedCount: 0,
	memberCount: 1,
	createdAt: '2026-09-01T08:00:00.000Z',
}

const projectsResponse = (projects: ProjectListItem[]) => ({ status: 200, data: { projects } })

const settingsOf = ({ id, name, slug, primaryColor }: ProjectListItem): ProjectSettings => ({
	id,
	name,
	slug,
	primaryColor,
	protectVariables: true,
	baseLanguageId: null,
})

const getList = () => screen.getByRole('list', { name: 'Zoznam projektov' })

/** The project rows only; each row also has a list of its language flags. */
const getRows = () => Array.from(getList().children) as HTMLElement[]

const clickLeave = async (name: string) => {
	fireEvent.click(await screen.findByRole('button', { name: `Opustiť projekt ${name}` }))
}

/** Picks languages in the Jazyky multi-select of the create modal, in this order. */
const pickLanguages = async (...labels: string[]) => {
	for (const label of labels) {
		fireEvent.click(screen.getByLabelText('Jazyky', { selector: 'input[data-type="visible"]' }))
		fireEvent.click(await screen.findByRole('option', { name: label }))
	}
}

const openCreate = async () => {
	fireEvent.click(await screen.findByRole('button', { name: 'Nový projekt' }))
	return screen.findByRole('dialog', { name: 'Nový projekt' })
}

beforeAll(() => {
	// The global 3 retries with backoff would delay the error state by seconds.
	queryClient.setQueryDefaults(QUERY_KEYS.PROJECTS.LIST(), { retry: false })
})

afterEach(() => {
	vi.restoreAllMocks()
})

describe('ProjectsPage list', () => {
	const names = () => getRows().map((item) => within(item).getAllByRole('link')[0]?.textContent)

	/** GET answers with the order of the last PUT, as the API does. */
	const orderRoutes = (initial: ProjectListItem[]) => {
		let projects = initial
		return {
			'GET /projects': () => projectsResponse(projects),
			'PUT /projects/order': (config: { data?: unknown }) => {
				const { projectIds } = JSON.parse(config.data as string) as { projectIds: string[] }
				projects = projectIds.map((id) => initial.find((project) => project.id === id)!)
				return { status: 204 }
			},
		}
	}

	const putOrder = (requests: { method?: string; url?: string; data?: unknown }[]) =>
		requests
			.filter((request) => request.method === 'put' && request.url === '/projects/order')
			.map((request) => JSON.parse(request.data as string) as unknown)

	it('moves a project with the arrow keys on its grip, saves the order, keeps the focus and announces the place', async () => {
		const requests = signedInAs(ADMIN_USER, orderRoutes([BOOKING, DEMO]))
		renderApp('/')
		await waitFor(getList)

		const grip = screen.getByRole('button', { name: 'Presunúť projekt Booking Web' })
		expect(grip).toHaveAccessibleDescription('Poradie zmeníte potiahnutím alebo šípkami hore a dole. Poradie je iba vaše.')
		act(() => grip.focus())
		fireEvent.keyDown(grip, { key: 'ArrowUp' })
		expect(putOrder(requests)).toEqual([])
		fireEvent.keyDown(grip, { key: 'ArrowDown' })

		await waitFor(() => expect(names()).toEqual(['Demo project', 'Booking Web']))
		expect(putOrder(requests)).toEqual([{ projectIds: [DEMO.id, BOOKING.id] }])
		expect(screen.getByRole('button', { name: 'Presunúť projekt Booking Web' })).toHaveFocus()
		expect(screen.getByText('Projekt Booking Web je na 2. mieste z 2.', { selector: '[role="status"]' })).toBeInTheDocument()
	})

	it('saves the order SortableJS reports after a drag, leaving the rows to React', async () => {
		const third: ProjectListItem = { ...BOOKING, id: '00000000-0000-4000-8000-000000000403', name: 'Third', slug: 'third' }
		const requests = signedInAs(ADMIN_USER, orderRoutes([BOOKING, DEMO, third]))
		renderApp('/')
		const list = await waitFor(getList)
		const rows = getRows()
		const sortable = Sortable.get(list)
		expect(sortable?.option('handle')).toMatch(/grip/)

		// jsdom cannot drag, so do what SortableJS does on a drop: move the row node, then call onEnd. Outside act, so nothing but the
		// drop handler itself renders: the new order must be in the DOM right away, before the browser could paint the row at its old place.
		list.insertBefore(rows[2]!, rows[1]!)
		sortable?.option('onEnd')?.({ item: rows[2]!, from: list, to: list, oldIndex: 2, newIndex: 1 } as unknown as Sortable.SortableEvent)
		expect(names()).toEqual(['Booking Web', 'Third', 'Demo project'])

		await waitFor(() => expect(putOrder(requests)).toHaveLength(1))
		expect(names()).toEqual(['Booking Web', 'Third', 'Demo project'])
		expect(putOrder(requests)).toEqual([{ projectIds: [BOOKING.id, third.id, DEMO.id] }])
		expect(getRows()).toHaveLength(3)
	})

	it('puts the order back and notifies when saving it fails', async () => {
		const show = vi.spyOn(notifications, 'show')
		signedInAs(ADMIN_USER, { 'GET /projects': projectsResponse([BOOKING, DEMO]), 'PUT /projects/order': apiError(404, 'NOT_FOUND') })
		renderApp('/')
		await waitFor(getList)

		fireEvent.keyDown(screen.getByRole('button', { name: 'Presunúť projekt Booking Web' }), { key: 'ArrowDown' })

		await waitFor(() => expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'red' })))
		await waitFor(() => expect(names()).toEqual(['Booking Web', 'Demo project']))
	})

	it('has no grip with a single project', async () => {
		signedInAs(ADMIN_USER, { 'GET /projects': projectsResponse([BOOKING]) })
		renderApp('/')
		await waitFor(getList)
		expect(screen.queryByRole('button', { name: /Presunúť projekt/ })).not.toBeInTheDocument()
	})

	it('renders the projects without the sidebar, with initials in the project color and links to the translations', async () => {
		signedInAs(ADMIN_USER, { 'GET /projects': projectsResponse([BOOKING, DEMO]) })
		renderApp('/')

		expect(await screen.findByRole('heading', { level: 1, name: 'Projekty' })).toBeInTheDocument()
		const list = within(await waitFor(getList))
		expect(getRows()).toHaveLength(2)
		expect(list.getByRole('link', { name: 'Booking Web' })).toHaveAttribute('href', `/projects/${BOOKING.slug}/translations`)
		expect(list.getByText('booking-web')).toBeInTheDocument()
		const initials = list.getByText('BW')
		expect(initials).toHaveStyle({ backgroundColor: '#FACC15' })
		expect(initials).toHaveAttribute('data-tone', 'dark')
		expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
	})

	it('shows the creation date, the key and member counts, the translated share over all languages and the language flags', async () => {
		signedInAs(ADMIN_USER, { 'GET /projects': projectsResponse([BOOKING, DEMO]) })
		renderApp('/')

		await waitFor(getList)
		const [booking, demo] = getRows().map((row) => within(row))
		// Rendered twice, for the wide and the narrow layout; CSS shows one of them.
		expect(booking?.getAllByText('Vytvorený 12. 10. 2026')).toHaveLength(2)
		expect(booking?.getByText('224 kľúčov')).toBeInTheDocument()
		expect(booking?.getByText('3 členovia')).toBeInTheDocument()
		expect(booking?.getByText('Preložené: > 99 %')).toBeInTheDocument()
		expect(booking?.getByText('Nepreložené: < 1 %')).toBeInTheDocument()
		expect(
			within(booking!.getByRole('list', { name: 'Jazyky projektu Booking Web' }))
				.getAllByRole('listitem')
				.map((item) => item.textContent),
		).toEqual(['English', 'Slovak'])
		expect(demo?.getByText('0 kľúčov')).toBeInTheDocument()
		expect(demo?.getByText('1 člen')).toBeInTheDocument()
		expect(demo?.getByText('Zatiaľ bez kľúčov')).toBeInTheDocument()
	})

	it('shows Nastavenia for every project and Opustiť projekt only for projects the user is a member of', async () => {
		signedInAs(ADMIN_USER, { 'GET /projects': projectsResponse([BOOKING, DEMO]) })
		renderApp('/')

		const list = within(await waitFor(getList))
		expect(list.getByRole('link', { name: 'Nastavenia projektu Booking Web' })).toHaveAttribute('href', `/projects/${BOOKING.slug}/settings`)
		expect(list.getByRole('button', { name: 'Opustiť projekt Booking Web' })).toBeInTheDocument()
		expect(list.getByRole('link', { name: 'Nastavenia projektu Demo project' })).toHaveAttribute('href', `/projects/${DEMO.slug}/settings`)
		expect(list.queryByRole('button', { name: 'Opustiť projekt Demo project' })).not.toBeInTheDocument()
	})

	it('shows a VISITOR of the project neither Nastavenia nor Opustiť projekt', async () => {
		signedInAs(VISITOR_USER, { 'GET /projects': projectsResponse([{ ...BOOKING, myRole: PROJECT_ROLE.VISITOR }]) })
		renderApp('/')

		const list = within(await waitFor(getList))
		expect(list.getByRole('link', { name: 'Booking Web' })).toBeInTheDocument()
		expect(list.queryByRole('link', { name: /^Nastavenia projektu/ })).not.toBeInTheDocument()
		expect(list.queryByRole('button', { name: /^Opustiť projekt/ })).not.toBeInTheDocument()
	})

	it('opens the project settings from the settings icon', async () => {
		signedInAs(EDITOR_USER, {
			'GET /projects': projectsResponse([BOOKING]),
			[`GET /projects/${BOOKING.id}/settings`]: { status: 200, data: settingsOf(BOOKING) },
			[`GET /projects/${BOOKING.id}/languages`]: { status: 200, data: [] },
		})
		const router = renderApp('/')

		fireEvent.click(await screen.findByRole('link', { name: 'Nastavenia projektu Booking Web' }))

		await waitFor(() => expect(router.state.location.pathname).toBe(`/projects/${BOOKING.slug}/settings`))
		expect(await screen.findByLabelText('Názov projektu')).toHaveValue('Booking Web')
	})

	it('shows the empty state with Nový projekt to an ADMIN', async () => {
		signedInAs(ADMIN_USER, { 'GET /projects': projectsResponse([]) })
		renderApp('/')

		expect(await screen.findByText('Zatiaľ nemáte žiadny projekt. Vytvorte prvý.')).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Nový projekt' })).toBeInTheDocument()
	})

	it('hides Nový projekt from an EDITOR and says an administrator adds them to a project', async () => {
		signedInAs(EDITOR_USER, { 'GET /projects': projectsResponse([]) })
		renderApp('/')

		expect(await screen.findByText('Zatiaľ nie ste v žiadnom projekte. Do projektu vás pridá administrátor.')).toBeInTheDocument()
		expect(screen.queryByRole('button', { name: 'Nový projekt' })).not.toBeInTheDocument()
	})

	it('shows the translated load error and retries', async () => {
		let backendUp = false
		signedInAs(EDITOR_USER, { 'GET /projects': () => (backendUp ? projectsResponse([BOOKING]) : apiError(500, 'INTERNAL_ERROR')) })
		renderApp('/')

		expect(await screen.findByText('Zoznam projektov sa nepodarilo načítať.')).toBeInTheDocument()
		expect(screen.getByText('Nastala neočakávaná chyba. Skúste to znova.')).toBeInTheDocument()

		backendUp = true
		fireEvent.click(screen.getByRole('button', { name: 'Skúsiť znova' }))

		expect(await screen.findByRole('link', { name: 'Booking Web' })).toBeInTheDocument()
		await waitFor(() => expect(getList()).toHaveFocus())
	})
})

describe('LeaveProjectModal from the list', () => {
	it('leaves the project after confirmation and refetches the list', async () => {
		const show = vi.spyOn(notifications, 'show')
		let projects = [BOOKING]
		const requests = signedInAs(EDITOR_USER, {
			'GET /projects': () => projectsResponse(projects),
			[`DELETE /projects/${BOOKING.id}/membership`]: () => {
				projects = []
				return { status: 204 }
			},
		})
		renderApp('/')

		await clickLeave('Booking Web')
		const dialog = await screen.findByRole('dialog', { name: 'Opustiť projekt' })
		expect(dialog).toHaveTextContent('Naozaj chcete opustiť projekt Booking Web?')
		fireEvent.click(within(dialog).getByRole('button', { name: 'Opustiť projekt' }))

		expect(await screen.findByText('Zatiaľ nie ste v žiadnom projekte. Do projektu vás pridá administrátor.')).toBeInTheDocument()
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
		expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'green', message: 'Opustili ste projekt Booking Web.' }))
		expect(requests.filter((request) => request.method === 'delete')).toHaveLength(1)
	})

	it('keeps the project and shows a server error as a notification', async () => {
		const show = vi.spyOn(notifications, 'show')
		signedInAs(EDITOR_USER, {
			'GET /projects': projectsResponse([BOOKING]),
			[`DELETE /projects/${BOOKING.id}/membership`]: apiError(500, 'INTERNAL_ERROR'),
		})
		renderApp('/')

		await clickLeave('Booking Web')
		fireEvent.click(within(await screen.findByRole('dialog', { name: 'Opustiť projekt' })).getByRole('button', { name: 'Opustiť projekt' }))

		await waitFor(() =>
			expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'red', message: 'Nastala neočakávaná chyba. Skúste to znova.' })),
		)
		expect(screen.getByRole('dialog', { name: 'Opustiť projekt' })).toBeInTheDocument()
		expect(screen.getByRole('link', { name: 'Booking Web' })).toBeInTheDocument()
	})

	it('closes without a request on cancel', async () => {
		const requests = signedInAs(EDITOR_USER, { 'GET /projects': projectsResponse([BOOKING]) })
		renderApp('/')

		await clickLeave('Booking Web')
		fireEvent.click(within(await screen.findByRole('dialog', { name: 'Opustiť projekt' })).getByRole('button', { name: 'Zrušiť' }))

		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
		expect(requests.some((request) => request.method === 'delete')).toBe(false)
	})
})

describe('CreateProjectModal', () => {
	it('suggests the slug from the name until the slug is edited', async () => {
		signedInAs(ADMIN_USER, { 'GET /projects': projectsResponse([]) })
		renderApp('/')
		const dialog = within(await openCreate())

		fireEvent.change(dialog.getByLabelText('Názov projektu'), { target: { value: 'Žltý kôň Web' } })
		expect(dialog.getByLabelText('Slug projektu')).toHaveValue('zlty-kon-web')

		fireEvent.change(dialog.getByLabelText('Slug projektu'), { target: { value: 'kon' } })
		fireEvent.change(dialog.getByLabelText('Názov projektu'), { target: { value: 'Iný názov' } })
		expect(dialog.getByLabelText('Slug projektu')).toHaveValue('kon')
	})

	it('shows client validation errors without sending a request', async () => {
		const requests = signedInAs(ADMIN_USER, { 'GET /projects': projectsResponse([]) })
		renderApp('/')
		const dialog = within(await openCreate())

		fireEvent.change(dialog.getByLabelText('Slug projektu'), { target: { value: 'Zlý Slug' } })
		fireEvent.click(dialog.getByRole('button', { name: 'Vytvoriť projekt' }))

		// Name and languages are both required.
		await waitFor(() => expect(dialog.getAllByText('Toto pole je povinné.')).toHaveLength(2))
		expect(dialog.getByText('Neplatná hodnota.')).toBeInTheDocument()
		expect(requests.some((request) => request.method === 'post')).toBe(false)
	})

	it('maps 409 SLUG_TAKEN to the slug field and keeps the modal open', async () => {
		signedInAs(ADMIN_USER, { 'GET /projects': projectsResponse([]), 'POST /projects': apiError(409, 'SLUG_TAKEN') })
		renderApp('/')
		const dialog = within(await openCreate())

		fireEvent.change(dialog.getByLabelText('Názov projektu'), { target: { value: 'Booking Web' } })
		await pickLanguages('Slovak – slovenčina – sk')
		fireEvent.click(dialog.getByRole('button', { name: 'Vytvoriť projekt' }))

		expect(await dialog.findByText('Projekt s týmto slugom už existuje.')).toBeInTheDocument()
		expect(dialog.getByLabelText('Slug projektu')).toHaveAttribute('aria-invalid', 'true')
		expect(screen.getByRole('dialog', { name: 'Nový projekt' })).toBeInTheDocument()
	})

	it('selects every language after the picked ones, so the first pick stays the base, and clears them again', async () => {
		const requests = signedInAs(ADMIN_USER, {
			'GET /projects': () => projectsResponse([]),
			'POST /projects': { status: 201, data: BOOKING },
			[`GET /projects/${BOOKING.id}/settings`]: { status: 200, data: settingsOf(BOOKING) },
			[`GET /projects/${BOOKING.id}/languages`]: { status: 200, data: [] },
		})
		renderApp('/')
		const dialog = within(await openCreate())
		fireEvent.change(dialog.getByLabelText('Názov projektu'), { target: { value: 'Booking Web' } })
		await pickLanguages('Slovak – slovenčina – sk')

		fireEvent.click(dialog.getByRole('button', { name: 'Vybrať všetky jazyky' }))
		fireEvent.click(dialog.getByRole('button', { name: 'Zrušiť výber jazykov' }))
		expect(dialog.queryByRole('button', { name: 'Zrušiť výber jazykov' })).not.toBeInTheDocument()
		fireEvent.click(dialog.getByRole('button', { name: 'Vybrať všetky jazyky' }))
		fireEvent.click(dialog.getByRole('button', { name: 'Vytvoriť projekt' }))

		await waitFor(() => expect(requests.some((request) => request.method === 'post')).toBe(true))
		const post = requests.find((request) => request.method === 'post')
		expect((JSON.parse(post?.data as string) as { languageTags: string[] }).languageTags).toEqual(SUPPORTED_LANGUAGES.map(({ tag }) => tag))
	})

	it('keeps the picked language first when selecting every language', async () => {
		const requests = signedInAs(ADMIN_USER, {
			'GET /projects': () => projectsResponse([]),
			'POST /projects': { status: 201, data: BOOKING },
			[`GET /projects/${BOOKING.id}/settings`]: { status: 200, data: settingsOf(BOOKING) },
			[`GET /projects/${BOOKING.id}/languages`]: { status: 200, data: [] },
		})
		renderApp('/')
		const dialog = within(await openCreate())
		fireEvent.change(dialog.getByLabelText('Názov projektu'), { target: { value: 'Booking Web' } })
		await pickLanguages('Slovak – slovenčina – sk')
		fireEvent.click(dialog.getByRole('button', { name: 'Vybrať všetky jazyky' }))
		fireEvent.click(dialog.getByRole('button', { name: 'Vytvoriť projekt' }))

		await waitFor(() => expect(requests.some((request) => request.method === 'post')).toBe(true))
		const { languageTags } = JSON.parse(requests.find((request) => request.method === 'post')?.data as string) as { languageTags: string[] }
		expect(languageTags[0]).toBe('sk')
		expect([...languageTags].sort()).toEqual(SUPPORTED_LANGUAGES.map(({ tag }) => tag).sort())
	})

	it('shows the flag in a picked language pill and clears the picks with the clear button', async () => {
		signedInAs(ADMIN_USER, { 'GET /projects': () => projectsResponse([]) })
		renderApp('/')
		const dialog = within(await openCreate())
		await pickLanguages('Slovak – slovenčina – sk')

		const pill = document.querySelector('.mantine-Pill-root')
		expect(pill).toHaveTextContent('Slovak – slovenčina – sk')
		expect(pill?.querySelector('[data-flag="sk"]')).toBeInTheDocument()
		// Mantine renders the clear button aria-hidden (mouse only), so it has no accessible role to query.
		fireEvent.click(document.querySelector('.mantine-InputClearButton-root')!)
		expect(dialog.getByRole('button', { name: 'Vybrať všetky jazyky' })).toBeInTheDocument()
		expect(document.querySelector('.mantine-Pill-root')).not.toBeInTheDocument()
	})

	it('creates the project, notifies and opens its settings', async () => {
		const show = vi.spyOn(notifications, 'show')
		let projects: ProjectListItem[] = []
		const requests = signedInAs(ADMIN_USER, {
			'GET /projects': () => projectsResponse(projects),
			'POST /projects': () => {
				projects = [BOOKING]
				return { status: 201, data: BOOKING }
			},
			[`GET /projects/${BOOKING.id}/settings`]: { status: 200, data: settingsOf(BOOKING) },
			[`GET /projects/${BOOKING.id}/languages`]: { status: 200, data: [] },
		})
		const router = renderApp('/')
		const dialog = within(await openCreate())

		fireEvent.change(dialog.getByLabelText('Názov projektu'), { target: { value: ' Booking Web ' } })
		await pickLanguages('English – English – en', 'Slovak – slovenčina – sk')
		fireEvent.click(dialog.getByRole('button', { name: 'Vytvoriť projekt' }))

		await waitFor(() => expect(router.state.location.pathname).toBe(`/projects/${BOOKING.slug}/settings`))
		const post = requests.find((request) => request.method === 'post')
		expect(JSON.parse(post?.data as string)).toEqual({ name: 'Booking Web', slug: 'booking-web', languageTags: ['en', 'sk'] })
		expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'green', message: 'Projekt Booking Web bol vytvorený.' }))
		expect(await screen.findByLabelText('Názov projektu')).toHaveValue('Booking Web')
	})
})
