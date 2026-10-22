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
		expect(within(card).getByRole('combobox', { name: 'Rola' })).toHaveValue('Editor')
		expect(within(card).getByText('Vytvorený 3. 10. 2026')).toBeInTheDocument()

		const table = within(getProjectsTable())
		expect(table.getByRole('columnheader', { name: 'Projekt' })).toBeInTheDocument()
		expect(table.getByRole('columnheader', { name: 'Slug' })).toBeInTheDocument()
		expect(table.getByRole('columnheader', { name: 'Pridaný' })).toBeInTheDocument()
		const rows = table.getAllByRole('row').slice(1)
		expect(rows).toHaveLength(2)
		const [bookingRow, iosRow] = rows as [HTMLElement, HTMLElement]
		expect(within(bookingRow).getByText('Booking Web')).toBeInTheDocument()
		// In the Slug and Pridaný columns and, for narrow screens (hidden by CSS otherwise), under the name.
		expect(within(bookingRow).getAllByText('booking-web')).toHaveLength(2)
		expect(within(bookingRow).getByText('13. 10. 2026')).toBeInTheDocument()
		expect(within(bookingRow).getByText('Pridaný 13. 10. 2026')).toBeInTheDocument()
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

describe('UserCard role', () => {
	it('saves a new role on change, updates the card and notifies', async () => {
		const show = vi.spyOn(notifications, 'show')
		let role: ROLE = ROLE.EDITOR
		const requests = signedInAs(ADMIN_USER, {
			...routes(() => ({ ...JANA, role })),
			[`PATCH ${USER_URL}`]: () => {
				role = ROLE.ADMIN
				return { status: 200, data: { ...JANA, role } }
			},
		})
		renderApp(USER_URL)
		const card = await screen.findByRole('region', { name: 'Účet používateľa' })

		fireEvent.click(within(card).getByRole('combobox', { name: 'Rola' }))
		fireEvent.click(await screen.findByRole('option', { name: 'Administrátor' }))

		await waitFor(() => expect(within(card).getByRole('combobox', { name: 'Rola' })).toHaveValue('Administrátor'))
		const patches = requests.filter((request) => request.method === 'patch')
		expect(patches).toHaveLength(1)
		expect(JSON.parse(patches[0]?.data as string)).toEqual({ role: 'ADMIN' })
		expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'green', message: 'Rola bola uložená.' }))
	})

	it('shows LAST_ADMIN as a notification and keeps the role', async () => {
		const show = vi.spyOn(notifications, 'show')
		const requests = signedInAs(ADMIN_USER, { ...routes(() => ({ ...JANA, role: ROLE.ADMIN })), [`PATCH ${USER_URL}`]: apiError(409, 'LAST_ADMIN') })
		renderApp(USER_URL)
		const card = await screen.findByRole('region', { name: 'Účet používateľa' })

		fireEvent.click(within(card).getByRole('combobox', { name: 'Rola' }))
		fireEvent.click(await screen.findByRole('option', { name: 'Editor' }))

		await waitFor(() =>
			expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'red', message: 'Posledný administrátor sa nemôže vzdať svojej roly.' })),
		)
		expect(within(card).getByRole('combobox', { name: 'Rola' })).toHaveValue('Administrátor')
		expect(requests.filter((request) => request.method === 'patch')).toHaveLength(1)
	})

	it('updates the own role in the sidebar when the admin changes their own account', async () => {
		const me: AdminUserDetail = { ...JANA, id: ADMIN_USER.id, email: ADMIN_USER.email, role: ROLE.ADMIN }
		const meUrl = `/admin/users/${me.id}`
		signedInAs(ADMIN_USER, {
			[`GET ${meUrl}`]: () => ({ status: 200, data: me }),
			'GET /admin/projects': () => ({ status: 200, data: { projects: [] } }),
			'GET /admin/users': () => ({ status: 200, data: { users: [] } }),
			[`PATCH ${meUrl}`]: () => ({ status: 200, data: { ...me, role: ROLE.EDITOR } }),
		})
		renderApp(meUrl)
		const card = await screen.findByRole('region', { name: 'Účet používateľa' })

		fireEvent.click(within(card).getByRole('combobox', { name: 'Rola' }))
		fireEvent.click(await screen.findByRole('option', { name: 'Editor' }))

		await waitFor(() => expect(within(screen.getByRole('banner')).getByText('Editor')).toBeInTheDocument())
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

describe('EditUserEmailModal', () => {
	const openEmailModal = async () => {
		fireEvent.click(await screen.findByRole('button', { name: `Upraviť e-mail používateľa ${JANA.email}` }))
		return screen.findByRole('dialog', { name: 'Upraviť e-mail' })
	}

	const typeEmail = (dialog: HTMLElement, value: string) => fireEvent.change(within(dialog).getByLabelText('E-mail'), { target: { value } })

	it('saves the new email, updates the card and notifies', async () => {
		const show = vi.spyOn(notifications, 'show')
		const requests = signedInAs(ADMIN_USER, {
			...routes(() => JANA),
			[`PATCH ${USER_URL}`]: () => ({ status: 200, data: { ...JANA, email: 'jana@firma.sk' } }),
		})
		renderApp(USER_URL)
		const dialog = await openEmailModal()
		expect(within(dialog).getByLabelText('E-mail')).toHaveValue(JANA.email)

		typeEmail(dialog, ' Jana@Firma.sk ')
		fireEvent.click(within(dialog).getByRole('button', { name: 'Uložiť' }))

		const card = await screen.findByRole('region', { name: 'Účet používateľa' })
		expect(await within(card).findByRole('heading', { name: 'jana@firma.sk' })).toBeInTheDocument()
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
		const patch = requests.find((request) => request.method === 'patch')
		expect(JSON.parse(patch?.data as string)).toEqual({ email: 'jana@firma.sk' })
		expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'green', message: 'E-mail bol zmenený na jana@firma.sk.' }))
	})

	it('shows 409 EMAIL_TAKEN and client validation at the field and keeps the modal open', async () => {
		const requests = signedInAs(ADMIN_USER, { ...routes(() => JANA), [`PATCH ${USER_URL}`]: apiError(409, 'EMAIL_TAKEN') })
		renderApp(USER_URL)
		const dialog = await openEmailModal()

		typeEmail(dialog, 'no-at-sign')
		fireEvent.click(within(dialog).getByRole('button', { name: 'Uložiť' }))
		expect(await within(dialog).findByText('Zadajte platný e-mail.')).toBeInTheDocument()
		expect(requests.filter((request) => request.method === 'patch')).toHaveLength(0)

		typeEmail(dialog, 'taken@firma.sk')
		fireEvent.click(within(dialog).getByRole('button', { name: 'Uložiť' }))
		expect(await within(dialog).findByText('Používateľ s týmto e-mailom už existuje.')).toBeInTheDocument()
		expect(screen.getByRole('dialog', { name: 'Upraviť e-mail' })).toBeInTheDocument()
	})

	it('keeps Uložiť disabled while the email is unchanged', async () => {
		const requests = signedInAs(
			ADMIN_USER,
			routes(() => JANA),
		)
		renderApp(USER_URL)
		const dialog = await openEmailModal()
		const button = within(dialog).getByRole('button', { name: 'Uložiť' })
		expect(button).toBeDisabled()

		typeEmail(dialog, 'jana.nova@firma.sk')
		expect(button).toBeEnabled()
		typeEmail(dialog, JANA.email)
		expect(button).toBeDisabled()
		expect(requests.filter((request) => request.method === 'patch')).toHaveLength(0)
	})
})

describe('Delete user from the detail', () => {
	it('deletes the user after confirmation and goes to the user list without loading the detail again', async () => {
		const show = vi.spyOn(notifications, 'show')
		const requests = signedInAs(ADMIN_USER, {
			...routes(() => JANA),
			[`DELETE ${USER_URL}`]: { status: 204 },
			'GET /admin/users': () => ({ status: 200, data: { users: [] } }),
		})
		const router = renderApp(USER_URL)

		fireEvent.click(await screen.findByRole('button', { name: 'Odstrániť používateľa' }))
		const dialog = await screen.findByRole('dialog', { name: 'Odstrániť používateľa' })
		fireEvent.click(within(dialog).getByRole('button', { name: 'Odstrániť' }))

		await waitFor(() => expect(router.state.location.pathname).toBe('/admin/users'))
		expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'green', message: `Používateľ ${JANA.email} bol odstránený.` }))
		expect(requests.filter((request) => request.method === 'get' && request.url === USER_URL)).toHaveLength(1)
		expect(screen.queryByText('Používateľ sa nenašiel')).not.toBeInTheDocument()
	})

	it('has no delete button on the own account', async () => {
		const me: AdminUserDetail = { ...JANA, id: ADMIN_USER.id, email: ADMIN_USER.email, role: ROLE.ADMIN }
		signedInAs(ADMIN_USER, { [`GET /admin/users/${me.id}`]: () => ({ status: 200, data: me }) })
		renderApp(`/admin/users/${me.id}`)

		expect(await screen.findByRole('region', { name: 'Účet používateľa' })).toBeInTheDocument()
		expect(screen.queryByRole('button', { name: 'Odstrániť používateľa' })).not.toBeInTheDocument()
		expect(screen.getByRole('button', { name: `Upraviť e-mail používateľa ${ADMIN_USER.email}` })).toBeInTheDocument()
	})
})
