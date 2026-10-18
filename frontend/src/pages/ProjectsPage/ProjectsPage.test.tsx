import { notifications } from '@mantine/notifications'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vite-plus/test'

import { type ProjectListItem, type ProjectSettings } from '@locale/shared'

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

const openActions = async (name: string) => {
	fireEvent.click(await screen.findByRole('button', { name: `Akcie projektu ${name}` }))
	return within(await screen.findByRole('menu'))
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
	it('renders the projects without the sidebar, with initials in the project color and links to the settings', async () => {
		signedInAs(ADMIN_USER, { 'GET /projects': projectsResponse([BOOKING, DEMO]) })
		renderApp('/')

		expect(await screen.findByRole('heading', { level: 1, name: 'Projekty' })).toBeInTheDocument()
		const list = within(await waitFor(getList))
		expect(list.getAllByRole('listitem')).toHaveLength(2)
		expect(list.getByRole('link', { name: 'Booking Web' })).toHaveAttribute('href', `/projects/${BOOKING.id}/settings`)
		expect(list.getByText('booking-web')).toBeInTheDocument()
		const initials = list.getByText('BW')
		expect(initials).toHaveStyle({ backgroundColor: '#FACC15' })
		expect(initials).toHaveAttribute('data-tone', 'dark')
		expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
	})

	it('offers Opustiť projekt only for projects the user is a member of', async () => {
		signedInAs(ADMIN_USER, { 'GET /projects': projectsResponse([BOOKING, DEMO]) })
		renderApp('/')

		const bookingMenu = await openActions('Booking Web')
		expect(bookingMenu.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Nastavenia', 'Opustiť projekt'])
		fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
		await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())

		const demoMenu = await openActions('Demo project')
		expect(demoMenu.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Nastavenia'])
	})

	it('opens the project settings from the menu', async () => {
		signedInAs(EDITOR_USER, {
			'GET /projects': projectsResponse([BOOKING]),
			[`GET /projects/${BOOKING.id}/settings`]: { status: 200, data: settingsOf(BOOKING) },
			'GET /languages': { status: 200, data: [] },
		})
		const router = renderApp('/')

		fireEvent.click((await openActions('Booking Web')).getByRole('menuitem', { name: 'Nastavenia' }))

		await waitFor(() => expect(router.state.location.pathname).toBe(`/projects/${BOOKING.id}/settings`))
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

		fireEvent.click((await openActions('Booking Web')).getByRole('menuitem', { name: 'Opustiť projekt' }))
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

		fireEvent.click((await openActions('Booking Web')).getByRole('menuitem', { name: 'Opustiť projekt' }))
		fireEvent.click(within(await screen.findByRole('dialog', { name: 'Opustiť projekt' })).getByRole('button', { name: 'Opustiť projekt' }))

		await waitFor(() => expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'red', message: 'Projekt musí mať aspoň jedného člena.' })))
		expect(screen.getByRole('dialog', { name: 'Opustiť projekt' })).toBeInTheDocument()
		expect(screen.getByRole('link', { name: 'Booking Web' })).toBeInTheDocument()
	})

	it('closes without a request on cancel', async () => {
		const requests = signedInAs(EDITOR_USER, { 'GET /projects': projectsResponse([BOOKING]) })
		renderApp('/')

		fireEvent.click((await openActions('Booking Web')).getByRole('menuitem', { name: 'Opustiť projekt' }))
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

		expect(await dialog.findByText('Toto pole je povinné.')).toBeInTheDocument()
		expect(dialog.getByText('Neplatná hodnota.')).toBeInTheDocument()
		expect(requests.some((request) => request.method === 'post')).toBe(false)
	})

	it('maps 409 SLUG_TAKEN to the slug field and keeps the modal open', async () => {
		signedInAs(EDITOR_USER, { 'GET /projects': projectsResponse([]), 'POST /projects': apiError(409, 'SLUG_TAKEN') })
		renderApp('/')
		const dialog = within(await openCreate())

		fireEvent.change(dialog.getByLabelText('Názov projektu'), { target: { value: 'Booking Web' } })
		fireEvent.click(dialog.getByRole('button', { name: 'Vytvoriť projekt' }))

		expect(await dialog.findByText('Projekt s týmto slugom už existuje.')).toBeInTheDocument()
		expect(dialog.getByLabelText('Slug projektu')).toHaveAttribute('aria-invalid', 'true')
		expect(screen.getByRole('dialog', { name: 'Nový projekt' })).toBeInTheDocument()
	})

	it('creates the project, notifies and opens its settings', async () => {
		const show = vi.spyOn(notifications, 'show')
		const requests = signedInAs(EDITOR_USER, {
			'GET /projects': projectsResponse([]),
			'POST /projects': { status: 201, data: BOOKING },
			[`GET /projects/${BOOKING.id}/settings`]: { status: 200, data: settingsOf(BOOKING) },
			'GET /languages': { status: 200, data: [] },
		})
		const router = renderApp('/')
		const dialog = within(await openCreate())

		fireEvent.change(dialog.getByLabelText('Názov projektu'), { target: { value: ' Booking Web ' } })
		fireEvent.click(dialog.getByRole('button', { name: 'Vytvoriť projekt' }))

		await waitFor(() => expect(router.state.location.pathname).toBe(`/projects/${BOOKING.id}/settings`))
		const post = requests.find((request) => request.method === 'post')
		expect(JSON.parse(post?.data as string)).toEqual({ name: 'Booking Web', slug: 'booking-web' })
		expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'green', message: 'Projekt Booking Web bol vytvorený.' }))
		expect(await screen.findByLabelText('Názov projektu')).toHaveValue('Booking Web')
	})
})
