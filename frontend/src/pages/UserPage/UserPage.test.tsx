import { notifications } from '@mantine/notifications'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vite-plus/test'

import { type AdminProjectListItem, type AdminUserDetail, type AdminUserProject, ROLE } from '@locale/shared'

import queryClient from '@/api/queryClient'
import { QUERY_KEYS } from '@/api/queryKeys'
import i18n from '@/lib/i18n'
import { ADMIN_USER, apiError, EDITOR_USER, signedInAs } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'

const BOOKING: AdminUserProject = {
	id: '00000000-0000-4000-8000-000000000601',
	name: 'Booking Web',
	slug: 'booking-web',
	primaryColor: '#E83E8C',
	joinedAt: '2026-10-13T10:00:00.000Z',
}

const IOS: AdminUserProject = {
	id: '00000000-0000-4000-8000-000000000602',
	name: 'B2C iOS',
	slug: 'b2c-ios',
	primaryColor: '#F8FAFC',
	joinedAt: '2026-10-15T10:00:00.000Z',
}

const asListItem = (project: AdminUserProject): AdminProjectListItem => ({
	id: project.id,
	name: project.name,
	slug: project.slug,
	primaryColor: project.primaryColor,
	baseLanguageTag: 'sk',
	languageCount: 1,
	memberCount: 1,
	createdAt: '2026-10-01T10:00:00.000Z',
})

const JANA: AdminUserDetail = {
	id: '00000000-0000-4000-8000-000000000012',
	email: 'jana.novakova@firma.sk',
	role: ROLE.EDITOR,
	projectCount: 1,
	createdAt: '2026-10-03T10:00:00.000Z',
	projects: [BOOKING],
}

const USER_URL = `/admin/users/${JANA.id}`

const routes = (user: () => AdminUserDetail, projects: () => AdminUserProject[] = () => [BOOKING, IOS]) => ({
	[`GET ${USER_URL}`]: () => ({ status: 200, data: user() }),
	'GET /admin/projects': () => ({ status: 200, data: { projects: projects().map(asListItem) } }),
})

const getProjectsTable = () => screen.getByRole('table', { name: 'Projekty používateľa' })

const openAddModal = async () => {
	fireEvent.click(await screen.findByRole('button', { name: 'Pridať do projektu' }))
	return screen.findByRole('dialog', { name: 'Pridať do projektu' })
}

const getProjectInput = (dialog: HTMLElement) => within(dialog).getByLabelText('Projekt', { selector: 'input' })

const pickProject = async (dialog: HTMLElement, name: string) => {
	fireEvent.click(await within(dialog).findByLabelText('Projekt', { selector: 'input' }))
	fireEvent.click(await screen.findByRole('option', { name }))
}

const submitAdd = (dialog: HTMLElement) => fireEvent.click(within(dialog).getByRole('button', { name: 'Pridať do projektu' }))

beforeAll(() => {
	// The global 3 retries with backoff would delay the error state by seconds. The detail sets its own retry, so only the delay is removed there.
	queryClient.setQueryDefaults(QUERY_KEYS.ADMIN.USER(JANA.id), { retryDelay: 0 })
	queryClient.setQueryDefaults(QUERY_KEYS.ADMIN.PROJECTS(), { retry: false })
})

afterEach(() => {
	vi.restoreAllMocks()
})

describe('UserPage', () => {
	it('shows the account card and the projects with dates in sk', async () => {
		signedInAs(
			ADMIN_USER,
			routes(() => ({ ...JANA, projects: [BOOKING, IOS] })),
		)
		renderApp(USER_URL)

		expect(await screen.findByRole('heading', { level: 1, name: 'Detail používateľa' })).toBeInTheDocument()
		const card = await screen.findByRole('region', { name: 'Účet používateľa' })
		expect(within(card).getByRole('heading', { level: 2, name: JANA.email })).toBeInTheDocument()
		expect(within(card).getByText('JA')).toBeInTheDocument()
		expect(within(card).getByText('Člen')).toBeInTheDocument()
		expect(within(card).getByText('Vytvorený 3. 10. 2026')).toBeInTheDocument()

		const table = within(getProjectsTable())
		expect(table.getByRole('columnheader', { name: 'Projekt' })).toBeInTheDocument()
		expect(table.getByRole('columnheader', { name: 'Slug' })).toBeInTheDocument()
		expect(table.getByRole('columnheader', { name: 'Pridaný' })).toBeInTheDocument()
		const rows = table.getAllByRole('row').slice(1)
		expect(rows).toHaveLength(2)
		const [bookingRow, iosRow] = rows as [HTMLElement, HTMLElement]
		expect(within(bookingRow).getByText('Booking Web')).toBeInTheDocument()
		expect(within(bookingRow).getByText('booking-web')).toBeInTheDocument()
		expect(within(bookingRow).getByText('13. 10. 2026')).toBeInTheDocument()
		expect(within(bookingRow).getByRole('link', { name: 'Otvoriť členov projektu Booking Web' })).toHaveAttribute('href', '/projects/booking-web/members')
		expect(within(bookingRow).getByRole('button', { name: 'Odobrať z projektu Booking Web' })).toBeInTheDocument()
		expect(within(iosRow).getByText('15. 10. 2026')).toBeInTheDocument()
	})

	it('formats dates in en', async () => {
		await i18n.changeLanguage('en')
		signedInAs(
			ADMIN_USER,
			routes(() => JANA),
		)
		renderApp(USER_URL)

		expect(await screen.findByText('Created 03/10/2026')).toBeInTheDocument()
		expect(screen.getByText('13/10/2026')).toBeInTheDocument()
		expect(screen.getByRole('columnheader', { name: 'Added' })).toBeInTheDocument()
		await i18n.changeLanguage('sk')
	})

	it('shows the empty state for a user without projects', async () => {
		signedInAs(
			ADMIN_USER,
			routes(() => ({ ...JANA, projectCount: 0, projects: [] })),
		)
		renderApp(USER_URL)

		expect(await screen.findByText('Používateľ zatiaľ nie je v žiadnom projekte.')).toBeInTheDocument()
	})

	it('shows the not-found state with a link back without retrying', async () => {
		const requests = signedInAs(ADMIN_USER, { [`GET ${USER_URL}`]: apiError(404, 'NOT_FOUND') })
		renderApp(USER_URL)

		expect(await screen.findByText('Používateľ sa nenašiel')).toBeInTheDocument()
		expect(screen.getByRole('link', { name: 'Späť na používateľov' })).toHaveAttribute('href', '/admin/users')
		expect(requests.filter((request) => request.url === USER_URL)).toHaveLength(1)
	})

	it('shows the translated load error and retries', async () => {
		let backendUp = false
		signedInAs(ADMIN_USER, { [`GET ${USER_URL}`]: () => (backendUp ? { status: 200, data: JANA } : apiError(500, 'INTERNAL_ERROR')) })
		renderApp(USER_URL)

		expect(await screen.findByText('Používateľa sa nepodarilo načítať.')).toBeInTheDocument()
		expect(screen.getByText('Nastala neočakávaná chyba. Skúste to znova.')).toBeInTheDocument()

		backendUp = true
		fireEvent.click(screen.getByRole('button', { name: 'Skúsiť znova' }))

		expect(await screen.findByText('Booking Web')).toBeInTheDocument()
	})

	it('shows the 403 page to an EDITOR and keeps the URL', async () => {
		const requests = signedInAs(EDITOR_USER)
		const router = renderApp(USER_URL)

		expect(await screen.findByRole('heading', { level: 1, name: 'Prístup zamietnutý' })).toBeInTheDocument()
		expect(router.state.location.pathname).toBe(USER_URL)
		expect(requests.some((request) => request.url === USER_URL)).toBe(false)
	})
})

describe('AddUserProjectModal', () => {
	it('offers only the projects the user is not in and loads them when opened', async () => {
		const requests = signedInAs(
			ADMIN_USER,
			routes(() => JANA),
		)
		renderApp(USER_URL)
		await screen.findByText('Booking Web')
		expect(requests.some((request) => request.url === '/admin/projects')).toBe(false)

		const dialog = await openAddModal()
		expect(within(dialog).getByRole('button', { name: 'Pridať do projektu' })).toBeDisabled()
		fireEvent.click(await within(dialog).findByLabelText('Projekt', { selector: 'input' }))

		expect(await screen.findByRole('option', { name: 'B2C iOS' })).toBeInTheDocument()
		expect(screen.getAllByRole('option')).toHaveLength(1)
	})

	it('adds the user to the project, refetches the detail and both admin lists and notifies', async () => {
		const show = vi.spyOn(notifications, 'show')
		const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
		let user = JANA
		const requests = signedInAs(ADMIN_USER, {
			...routes(() => user),
			[`POST /projects/${IOS.id}/members`]: () => {
				user = { ...JANA, projectCount: 2, projects: [IOS, BOOKING] }
				return { status: 201, data: { id: JANA.id, email: JANA.email, firstName: null, lastName: null, createdAt: '2026-10-19T10:00:00.000Z' } }
			},
		})
		renderApp(USER_URL)
		const dialog = await openAddModal()

		await pickProject(dialog, 'B2C iOS')
		submitAdd(dialog)

		expect(await within(getProjectsTable()).findByText('B2C iOS')).toBeInTheDocument()
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
		const post = requests.find((request) => request.method === 'post')
		expect(JSON.parse(post?.data as string)).toEqual({ userId: JANA.id })
		expect(requests.filter((request) => request.method === 'get' && request.url === USER_URL)).toHaveLength(2)
		expect(invalidate).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.ADMIN.USERS() })
		expect(invalidate).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.ADMIN.PROJECTS() })
		expect(invalidate).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.PROJECTS.MEMBERS(IOS.id) })
		expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'green', message: `${JANA.email} bol pridaný do projektu B2C iOS.` }))
		await waitFor(() => expect(screen.getByRole('button', { name: 'Pridať do projektu' })).toHaveFocus())
	})

	it('shows 409 ALREADY_MEMBER at the select, clears it and keeps the modal open', async () => {
		signedInAs(ADMIN_USER, { ...routes(() => JANA), [`POST /projects/${IOS.id}/members`]: apiError(409, 'ALREADY_MEMBER') })
		renderApp(USER_URL)
		const dialog = await openAddModal()

		await pickProject(dialog, 'B2C iOS')
		submitAdd(dialog)

		expect(await within(dialog).findByText('Používateľ už je členom projektu.')).toBeInTheDocument()
		const input = getProjectInput(dialog)
		expect(input).toHaveAttribute('aria-invalid', 'true')
		expect(input).toHaveValue('')
		expect(input).toHaveFocus()
		expect(screen.getByRole('dialog', { name: 'Pridať do projektu' })).toBeInTheDocument()
	})

	it('shows the projects load error and retries', async () => {
		let backendUp = false
		signedInAs(ADMIN_USER, {
			[`GET ${USER_URL}`]: { status: 200, data: JANA },
			'GET /admin/projects': () => (backendUp ? { status: 200, data: { projects: [BOOKING, IOS].map(asListItem) } } : apiError(500, 'INTERNAL_ERROR')),
		})
		renderApp(USER_URL)
		const dialog = await openAddModal()

		expect(await within(dialog).findByText('Projekty sa nepodarilo načítať.')).toBeInTheDocument()

		backendUp = true
		fireEvent.click(within(dialog).getByRole('button', { name: 'Skúsiť znova' }))

		expect(await within(dialog).findByLabelText('Projekt', { selector: 'input' })).toBeInTheDocument()
	})
})

describe('RemoveUserProjectModal', () => {
	it('removes the user from the project after confirmation, refetches and focuses the table', async () => {
		const show = vi.spyOn(notifications, 'show')
		const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
		let user: AdminUserDetail = { ...JANA, projectCount: 2, projects: [IOS, BOOKING] }
		const requests = signedInAs(ADMIN_USER, {
			...routes(() => user),
			[`DELETE /projects/${BOOKING.id}/members/${JANA.id}`]: () => {
				user = { ...JANA, projects: [IOS] }
				return { status: 204 }
			},
		})
		renderApp(USER_URL)

		fireEvent.click(await screen.findByRole('button', { name: 'Odobrať z projektu Booking Web' }))
		const dialog = await screen.findByRole('dialog', { name: 'Odobrať z projektu' })
		expect(dialog).toHaveTextContent(`Naozaj chcete odobrať ${JANA.email} z projektu Booking Web?`)
		fireEvent.click(within(dialog).getByRole('button', { name: 'Odobrať' }))

		await waitFor(() => expect(within(getProjectsTable()).queryByText('Booking Web')).not.toBeInTheDocument())
		expect(screen.getByText('B2C iOS')).toBeInTheDocument()
		expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'green', message: `${JANA.email} bol odobraný z projektu Booking Web.` }))
		expect(requests.filter((request) => request.method === 'delete')).toHaveLength(1)
		expect(invalidate).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.ADMIN.USERS() })
		expect(invalidate).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.PROJECTS.MEMBERS(BOOKING.id) })
		await waitFor(() => expect(getProjectsTable()).toHaveFocus())
	})

	it('shows LAST_MEMBER as a notification and keeps the row', async () => {
		const show = vi.spyOn(notifications, 'show')
		signedInAs(ADMIN_USER, { ...routes(() => JANA), [`DELETE /projects/${BOOKING.id}/members/${JANA.id}`]: apiError(409, 'LAST_MEMBER') })
		renderApp(USER_URL)

		fireEvent.click(await screen.findByRole('button', { name: 'Odobrať z projektu Booking Web' }))
		fireEvent.click(within(await screen.findByRole('dialog', { name: 'Odobrať z projektu' })).getByRole('button', { name: 'Odobrať' }))

		await waitFor(() => expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'red', message: 'Projekt musí mať aspoň jedného člena.' })))
		expect(screen.getByText('Booking Web')).toBeInTheDocument()
	})

	it('cancel sends nothing', async () => {
		const requests = signedInAs(
			ADMIN_USER,
			routes(() => JANA),
		)
		renderApp(USER_URL)

		fireEvent.click(await screen.findByRole('button', { name: 'Odobrať z projektu Booking Web' }))
		fireEvent.click(within(await screen.findByRole('dialog', { name: 'Odobrať z projektu' })).getByRole('button', { name: 'Zrušiť' }))

		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
		expect(requests.some((request) => request.method === 'delete')).toBe(false)
	})
})
