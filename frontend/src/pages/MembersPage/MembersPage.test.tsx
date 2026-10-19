import { notifications } from '@mantine/notifications'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vite-plus/test'

import { type AdminUser, type ProjectMember, type ProjectSettings, ROLE } from '@locale/shared'

import queryClient from '@/api/queryClient'
import { QUERY_KEYS } from '@/api/queryKeys'
import { ADMIN_USER, apiError, EDITOR_USER, projectListRoute, signedInAs } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'

const PROJECT: ProjectSettings = {
	id: '00000000-0000-4000-8000-000000000501',
	name: 'Booking Web',
	slug: 'booking-web',
	primaryColor: '#E83E8C',
	protectVariables: true,
	baseLanguageId: null,
}

const JANA: ProjectMember = {
	id: EDITOR_USER.id,
	email: 'jana.novakova@firma.sk',
	firstName: 'Jana',
	lastName: 'Nováková',
	createdAt: '2026-10-03T10:00:00.000Z',
}

const PETER: ProjectMember = {
	id: '00000000-0000-4000-8000-000000000502',
	email: 'peter.maly@firma.sk',
	firstName: 'Peter',
	lastName: 'Malý',
	createdAt: '2026-10-18T10:00:00.000Z',
}

const ADMIN_MEMBER: ProjectMember = {
	id: ADMIN_USER.id,
	email: ADMIN_USER.email,
	firstName: 'Martin',
	lastName: 'Kováč',
	createdAt: '2026-10-01T10:00:00.000Z',
}

const asAdminUser = (member: ProjectMember, role: ROLE, projectCount: number): AdminUser => ({
	id: member.id,
	email: member.email,
	role,
	projectCount,
	createdAt: member.createdAt,
})

const JANA_USER = asAdminUser(JANA, ROLE.EDITOR, 1)
const PETER_USER = asAdminUser(PETER, ROLE.EDITOR, 0)
const ADMIN_SELF = asAdminUser(ADMIN_MEMBER, ROLE.ADMIN, 2)

const NEW_USER: AdminUser = {
	id: '00000000-0000-4000-8000-000000000503',
	email: 'nova@firma.sk',
	role: ROLE.EDITOR,
	projectCount: 0,
	createdAt: '2026-10-19T10:00:00.000Z',
}

const MEMBERS_URL = `/projects/${PROJECT.id}/members`

const PAGE_PATH = `/projects/${PROJECT.slug}/members`

const routes = (members: () => ProjectMember[], users: () => AdminUser[] = () => [ADMIN_SELF, JANA_USER, PETER_USER]) => ({
	...projectListRoute(PROJECT),
	[`GET /projects/${PROJECT.id}/settings`]: { status: 200, data: PROJECT },
	[`GET ${MEMBERS_URL}`]: () => ({ status: 200, data: { members: members() } }),
	'GET /admin/users': () => ({ status: 200, data: { users: users() } }),
})

const openAddModal = async () => {
	fireEvent.click(await screen.findByRole('button', { name: 'Pridať člena' }))
	return screen.findByRole('dialog', { name: 'Pridať člena' })
}

const getUserInput = (dialog: HTMLElement) => within(dialog).getByLabelText('Používateľ', { selector: 'input' })

const pickUser = async (dialog: HTMLElement, email: string) => {
	fireEvent.click(await within(dialog).findByLabelText('Používateľ', { selector: 'input' }))
	fireEvent.click(await screen.findByRole('option', { name: email }))
}

const submitAdd = (dialog: HTMLElement) => fireEvent.click(within(dialog).getByRole('button', { name: 'Pridať člena' }))

beforeAll(() => {
	// The global 3 retries with backoff would delay the error state by seconds.
	queryClient.setQueryDefaults(QUERY_KEYS.ADMIN.USERS(), { retry: false })
})

afterEach(() => {
	vi.restoreAllMocks()
})

describe('MembersPage', () => {
	it('lists the members with name, email and the date they joined', async () => {
		signedInAs(
			EDITOR_USER,
			routes(() => [JANA]),
		)
		renderApp(PAGE_PATH)

		expect(await screen.findByRole('heading', { level: 1, name: 'Členovia' })).toBeInTheDocument()
		const table = within(screen.getByRole('table', { name: 'Zoznam členov' }))
		expect(await table.findByText('Jana Nováková')).toBeInTheDocument()
		expect(table.getByText('jana.novakova@firma.sk')).toBeInTheDocument()
		expect(table.getByText('JN')).toBeInTheDocument()
		expect(table.getByText('3. 10. 2026')).toBeInTheDocument()
	})

	it('shows a member the list without Pridať člena and without row actions', async () => {
		const requests = signedInAs(
			EDITOR_USER,
			routes(() => [JANA, PETER]),
		)
		renderApp(PAGE_PATH)

		expect(await screen.findByText('Peter Malý')).toBeInTheDocument()
		expect(screen.queryByRole('button', { name: 'Pridať člena' })).not.toBeInTheDocument()
		expect(screen.queryByRole('button', { name: /Odobrať .* z projektu/ })).not.toBeInTheDocument()
		expect(screen.getByRole('columnheader', { name: 'Akcie' })).toBeInTheDocument()
		expect(requests.some((request) => request.url === '/admin/users')).toBe(false)
	})

	it('offers an admin only the users who are not members yet', async () => {
		const requests = signedInAs(
			ADMIN_USER,
			routes(() => [ADMIN_MEMBER, JANA]),
		)
		renderApp(PAGE_PATH)
		await screen.findByText('Jana Nováková')
		expect(requests.some((request) => request.url === '/admin/users')).toBe(false)

		const dialog = await openAddModal()
		expect(within(dialog).getByRole('button', { name: 'Pridať člena' })).toBeDisabled()
		fireEvent.click(await within(dialog).findByLabelText('Používateľ', { selector: 'input' }))

		expect(await screen.findByRole('option', { name: PETER.email })).toBeInTheDocument()
		expect(screen.getAllByRole('option')).toHaveLength(1)
		expect(screen.queryByRole('option', { name: JANA.email })).not.toBeInTheDocument()
	})

	it('adds an existing user, closes the modal, refetches the lists and notifies', async () => {
		const show = vi.spyOn(notifications, 'show')
		let members = [ADMIN_MEMBER, JANA]
		const requests = signedInAs(ADMIN_USER, {
			...routes(() => members),
			[`POST ${MEMBERS_URL}`]: () => {
				members = [ADMIN_MEMBER, JANA, PETER]
				return { status: 201, data: PETER }
			},
		})
		renderApp(PAGE_PATH)
		const dialog = await openAddModal()

		await pickUser(dialog, PETER.email)
		submitAdd(dialog)

		expect(await screen.findByText('Peter Malý')).toBeInTheDocument()
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
		const post = requests.find((request) => request.method === 'post')
		expect(JSON.parse(post?.data as string)).toEqual({ userId: PETER.id })
		expect(requests.filter((request) => request.method === 'get' && request.url === '/admin/users')).toHaveLength(2)
		expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'green', message: `Člen ${PETER.email} bol pridaný do projektu.` }))
	})

	it('shows 409 ALREADY_MEMBER at the select, clears it and keeps the modal open', async () => {
		signedInAs(ADMIN_USER, { ...routes(() => [ADMIN_MEMBER, JANA]), [`POST ${MEMBERS_URL}`]: apiError(409, 'ALREADY_MEMBER') })
		renderApp(PAGE_PATH)
		const dialog = await openAddModal()

		await pickUser(dialog, PETER.email)
		submitAdd(dialog)

		expect(await within(dialog).findByText('Používateľ už je členom projektu.')).toBeInTheDocument()
		const input = getUserInput(dialog)
		expect(input).toHaveAttribute('aria-invalid', 'true')
		expect(input).toHaveValue('')
		expect(input).toHaveFocus()
		expect(screen.getByRole('dialog', { name: 'Pridať člena' })).toBeInTheDocument()
	})

	it('shows other errors as a notification', async () => {
		const show = vi.spyOn(notifications, 'show')
		signedInAs(ADMIN_USER, { ...routes(() => [ADMIN_MEMBER, JANA]), [`POST ${MEMBERS_URL}`]: apiError(500, 'INTERNAL_ERROR') })
		renderApp(PAGE_PATH)
		const dialog = await openAddModal()

		await pickUser(dialog, PETER.email)
		submitAdd(dialog)

		await waitFor(() =>
			expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'red', message: 'Nastala neočakávaná chyba. Skúste to znova.' })),
		)
		expect(screen.getByRole('dialog', { name: 'Pridať člena' })).toBeInTheDocument()
	})

	it('shows the users load error and retries', async () => {
		let backendUp = false
		signedInAs(ADMIN_USER, {
			...routes(() => [ADMIN_MEMBER, JANA]),
			'GET /admin/users': () => (backendUp ? { status: 200, data: { users: [ADMIN_SELF, JANA_USER, PETER_USER] } } : apiError(500, 'INTERNAL_ERROR')),
		})
		renderApp(PAGE_PATH)
		const dialog = await openAddModal()

		expect(await within(dialog).findByText('Používateľov sa nepodarilo načítať.')).toBeInTheDocument()
		expect(within(dialog).getByText('Nastala neočakávaná chyba. Skúste to znova.')).toBeInTheDocument()

		backendUp = true
		fireEvent.click(within(dialog).getByRole('button', { name: 'Skúsiť znova' }))

		expect(await within(dialog).findByLabelText('Používateľ', { selector: 'input' })).toBeInTheDocument()
	})

	it('creates a new user from the modal with the role Člen and preselects them', async () => {
		let users = [ADMIN_SELF, JANA_USER]
		const requests = signedInAs(ADMIN_USER, {
			...routes(
				() => [ADMIN_MEMBER, JANA],
				() => users,
			),
			'POST /admin/users': () => {
				users = [NEW_USER, ...users]
				return { status: 201, data: NEW_USER }
			},
			[`POST ${MEMBERS_URL}`]: { status: 201, data: { ...NEW_USER, firstName: null, lastName: null } },
		})
		renderApp(PAGE_PATH)
		const addDialog = await openAddModal()
		await within(addDialog).findByLabelText('Používateľ', { selector: 'input' })

		fireEvent.click(within(addDialog).getByRole('button', { name: 'Vytvoriť nového používateľa' }))
		const createDialog = await screen.findByRole('dialog', { name: 'Nový používateľ' })
		expect(within(createDialog).getByRole('radio', { name: 'Člen' })).toBeChecked()
		fireEvent.change(within(createDialog).getByLabelText('E-mail'), { target: { value: NEW_USER.email } })
		fireEvent.change(within(createDialog).getByLabelText('Heslo'), { target: { value: 'NewMemberPassword1' } })
		fireEvent.click(within(createDialog).getByRole('button', { name: 'Vytvoriť používateľa' }))

		await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Nový používateľ' })).not.toBeInTheDocument())
		const createPost = requests.find((request) => request.method === 'post' && request.url === '/admin/users')
		expect(JSON.parse(createPost?.data as string)).toEqual({ email: NEW_USER.email, password: 'NewMemberPassword1', role: 'EDITOR' })
		expect(getUserInput(addDialog)).toHaveValue(NEW_USER.email)

		submitAdd(addDialog)
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
		const addPost = requests.find((request) => request.method === 'post' && request.url === MEMBERS_URL)
		expect(JSON.parse(addPost?.data as string)).toEqual({ userId: NEW_USER.id })
	})
})

describe('RemoveMemberModal', () => {
	it('offers an admin no remove for the own row', async () => {
		signedInAs(
			ADMIN_USER,
			routes(() => [ADMIN_MEMBER, PETER]),
		)
		renderApp(PAGE_PATH)

		expect(await screen.findByRole('button', { name: `Odobrať ${PETER.email} z projektu` })).toBeInTheDocument()
		expect(screen.queryByRole('button', { name: `Odobrať ${ADMIN_MEMBER.email} z projektu` })).not.toBeInTheDocument()
	})

	it('removes a member after confirmation and refetches the members and users', async () => {
		const show = vi.spyOn(notifications, 'show')
		const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
		let members = [JANA, PETER]
		const requests = signedInAs(ADMIN_USER, {
			...routes(() => members),
			[`DELETE ${MEMBERS_URL}/${PETER.id}`]: () => {
				members = [JANA]
				return { status: 204 }
			},
		})
		renderApp(PAGE_PATH)

		fireEvent.click(await screen.findByRole('button', { name: `Odobrať ${PETER.email} z projektu` }))
		const dialog = await screen.findByRole('dialog', { name: 'Odobrať z projektu' })
		expect(dialog).toHaveTextContent(`Naozaj chcete odobrať ${PETER.email} z projektu?`)
		fireEvent.click(within(dialog).getByRole('button', { name: 'Odobrať' }))

		await waitFor(() => expect(screen.queryByText('Peter Malý')).not.toBeInTheDocument())
		expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'green', message: `${PETER.email} bol odobraný z projektu.` }))
		expect(requests.filter((request) => request.method === 'delete')).toHaveLength(1)
		expect(invalidate).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.ADMIN.USERS() })
	})

	it('shows LAST_MEMBER as a notification and keeps the row', async () => {
		const show = vi.spyOn(notifications, 'show')
		signedInAs(ADMIN_USER, { ...routes(() => [JANA, PETER]), [`DELETE ${MEMBERS_URL}/${PETER.id}`]: apiError(409, 'LAST_MEMBER') })
		renderApp(PAGE_PATH)

		fireEvent.click(await screen.findByRole('button', { name: `Odobrať ${PETER.email} z projektu` }))
		fireEvent.click(within(await screen.findByRole('dialog', { name: 'Odobrať z projektu' })).getByRole('button', { name: 'Odobrať' }))

		await waitFor(() => expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'red', message: 'Projekt musí mať aspoň jedného člena.' })))
		expect(screen.getByText('Peter Malý')).toBeInTheDocument()
	})
})
