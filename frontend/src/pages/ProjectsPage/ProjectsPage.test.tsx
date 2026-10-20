import { notifications } from '@mantine/notifications'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vite-plus/test'

import { type ProjectListItem, type ProjectSettings, SUPPORTED_LANGUAGES } from '@locale/shared'

import queryClient from '@/api/queryClient'
import { QUERY_KEYS } from '@/api/queryKeys'
import { ADMIN_USER, apiError, EDITOR_USER, signedInAs } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'

const BOOKING: ProjectListItem = {
	id: '00000000-0000-4000-8000-000000000401',
	name: 'Booking Web',
	slug: 'booking-web',
	primaryColor: '#FACC15',
	isMember: true,
}

const DEMO: ProjectListItem = {
	id: '00000000-0000-4000-8000-000000000402',
	name: 'Demo project',
	slug: 'demo-project',
	primaryColor: '#1D4ED8',
	isMember: false,
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
	const names = () =>
		within(getList())
			.getAllByRole('listitem')
			.map((item) => within(item).getAllByRole('link')[0]?.textContent)

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

	it('drops a dragged project above or below the row under the pointer', async () => {
		const third: ProjectListItem = { ...BOOKING, id: '00000000-0000-4000-8000-000000000403', name: 'Third', slug: 'third' }
		const requests = signedInAs(ADMIN_USER, orderRoutes([BOOKING, DEMO, third]))
		renderApp('/')
		await waitFor(getList)
		const rows = within(getList()).getAllByRole('listitem')
		const dataTransfer = { effectAllowed: '', setData: vi.fn(), setDragImage: vi.fn() }

		fireEvent.dragStart(screen.getByRole('button', { name: 'Presunúť projekt Third' }), { dataTransfer })
		// jsdom has no layout: every rect is 0 high, so clientY 1 is past the middle and lands after the row.
		fireEvent.dragOver(rows[0]!, { dataTransfer, clientY: 1 })
		expect(rows[0]).toHaveAttribute('data-drop', 'after')
		fireEvent.drop(rows[0]!, { dataTransfer, clientY: 1 })

		await waitFor(() => expect(names()).toEqual(['Booking Web', 'Third', 'Demo project']))
		expect(putOrder(requests)).toEqual([{ projectIds: [BOOKING.id, third.id, DEMO.id] }])
		expect(rows[0]).not.toHaveAttribute('data-drop')
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
		expect(list.getAllByRole('listitem')).toHaveLength(2)
		expect(list.getByRole('link', { name: 'Booking Web' })).toHaveAttribute('href', `/projects/${BOOKING.slug}/translations`)
		expect(list.getByText('booking-web')).toBeInTheDocument()
		const initials = list.getByText('BW')
		expect(initials).toHaveStyle({ backgroundColor: '#FACC15' })
		expect(initials).toHaveAttribute('data-tone', 'dark')
		expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
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

	it('shows the empty state', async () => {
		signedInAs(EDITOR_USER, { 'GET /projects': projectsResponse([]) })
		renderApp('/')

		expect(await screen.findByText('Zatiaľ nemáte žiadny projekt. Vytvorte prvý.')).toBeInTheDocument()
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

		expect(await screen.findByText('Zatiaľ nemáte žiadny projekt. Vytvorte prvý.')).toBeInTheDocument()
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
		expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'green', message: 'Opustili ste projekt Booking Web.' }))
		expect(requests.filter((request) => request.method === 'delete')).toHaveLength(1)
	})

	it('keeps the project and shows LAST_MEMBER as a notification', async () => {
		const show = vi.spyOn(notifications, 'show')
		signedInAs(EDITOR_USER, {
			'GET /projects': projectsResponse([BOOKING]),
			[`DELETE /projects/${BOOKING.id}/membership`]: apiError(409, 'LAST_MEMBER'),
		})
		renderApp('/')

		await clickLeave('Booking Web')
		fireEvent.click(within(await screen.findByRole('dialog', { name: 'Opustiť projekt' })).getByRole('button', { name: 'Opustiť projekt' }))

		await waitFor(() => expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'red', message: 'Projekt musí mať aspoň jedného člena.' })))
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
		signedInAs(EDITOR_USER, { 'GET /projects': projectsResponse([]) })
		renderApp('/')
		const dialog = within(await openCreate())

		fireEvent.change(dialog.getByLabelText('Názov projektu'), { target: { value: 'Žltý kôň Web' } })
		expect(dialog.getByLabelText('Slug projektu')).toHaveValue('zlty-kon-web')

		fireEvent.change(dialog.getByLabelText('Slug projektu'), { target: { value: 'kon' } })
		fireEvent.change(dialog.getByLabelText('Názov projektu'), { target: { value: 'Iný názov' } })
		expect(dialog.getByLabelText('Slug projektu')).toHaveValue('kon')
	})

	it('shows client validation errors without sending a request', async () => {
		const requests = signedInAs(EDITOR_USER, { 'GET /projects': projectsResponse([]) })
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
		signedInAs(EDITOR_USER, { 'GET /projects': projectsResponse([]), 'POST /projects': apiError(409, 'SLUG_TAKEN') })
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
		const requests = signedInAs(EDITOR_USER, {
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
		const requests = signedInAs(EDITOR_USER, {
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
		signedInAs(EDITOR_USER, { 'GET /projects': () => projectsResponse([]) })
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
		const requests = signedInAs(EDITOR_USER, {
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
