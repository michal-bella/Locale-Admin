import { notifications } from '@mantine/notifications'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vite-plus/test'

import { type AdminUser, PROJECT_ROLE, type ProjectMember, type ProjectSettings, ROLE } from '@locale/shared'

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
	role: PROJECT_ROLE.EDITOR,
	projectCount: 1,
	createdAt: '2026-10-03T10:00:00.000Z',
}

const PETER: ProjectMember = {
	id: '00000000-0000-4000-8000-000000000502',
	email: 'peter.maly@firma.sk',
	firstName: 'Peter',
	lastName: 'Malý',
	role: PROJECT_ROLE.EDITOR,
	projectCount: 3,
	createdAt: '2026-10-18T10:00:00.000Z',
}

const ADMIN_MEMBER: ProjectMember = {
	id: ADMIN_USER.id,
	email: ADMIN_USER.email,
	firstName: 'Martin',
	lastName: 'Kováč',
	role: PROJECT_ROLE.MANAGER,
	projectCount: 2,
	createdAt: '2026-10-01T10:00:00.000Z',
}

const asAdminUser = ({ id, email, projectCount, createdAt }: ProjectMember, role = ROLE.USER): AdminUser => ({
	id,
	email,
	role,
	isActive: true,
	hasPassword: true,
	hasGoogle: false,
	projectCount,
	lastLoginAt: null,
	createdAt,
})

const JANA_USER = asAdminUser(JANA)
const PETER_USER = asAdminUser(PETER)
const ADMIN_SELF = asAdminUser(ADMIN_MEMBER, ROLE.ADMIN)

const NEW_USER: AdminUser = {
	id: '00000000-0000-4000-8000-000000000503',
	email: 'nova@firma.sk',
	role: ROLE.USER,
	isActive: true,
	hasPassword: true,
	hasGoogle: false,
	lastLoginAt: null,
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
	it('lists the members with name, email, role, project count and the date they joined', async () => {
		signedInAs(
			EDITOR_USER,
			routes(() => [JANA, ADMIN_MEMBER]),
		)
		renderApp(PAGE_PATH)

		expect(await screen.findByRole('heading', { level: 1, name: 'Členovia' })).toBeInTheDocument()
		const table = within(screen.getByRole('table', { name: 'Zoznam členov' }))
		expect(table.getByRole('columnheader', { name: 'Člen' })).toBeInTheDocument()
		expect(table.getByRole('columnheader', { name: 'Rola' })).toBeInTheDocument()
		expect(table.getByRole('columnheader', { name: 'Projekty' })).toBeInTheDocument()
		expect(table.getByRole('columnheader', { name: 'Pridaný' })).toBeInTheDocument()
		const jana = within(await table.findByRole('row', { name: /Jana Nováková/ }))
		expect(jana.getByText('jana.novakova@firma.sk')).toBeInTheDocument()
		expect(jana.getByText('JN')).toBeInTheDocument()
		expect(jana.getAllByText('Editor')).toHaveLength(2)
		expect(jana.getByText('1')).toBeInTheDocument()
		expect(jana.getByText('3. 10. 2026')).toBeInTheDocument()
		expect(jana.getByText('1 projekt · Pridaný 3. 10. 2026')).toBeInTheDocument()
		const admin = within(table.getByRole('row', { name: /Martin Kováč/ }))
		expect(admin.getAllByText('Správca')).toHaveLength(2)
		expect(admin.getByText('2')).toBeInTheDocument()
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
		expect(screen.queryByRole('link', { name: /Otvoriť používateľa/ })).not.toBeInTheDocument()
		expect(screen.getByRole('columnheader', { name: 'Akcie' })).toBeInTheDocument()
		expect(screen.queryByRole('combobox', { name: /^Rola používateľa/ })).not.toBeInTheDocument()
		expect(requests.some((request) => request.url === '/admin/users')).toBe(false)
	})

	it('lets an admin change the role of a member, refetches the members and notifies', async () => {
		const show = vi.spyOn(notifications, 'show')
		let members = [ADMIN_MEMBER, JANA]
		const requests = signedInAs(ADMIN_USER, {
			...routes(() => members),
			[`PATCH ${MEMBERS_URL}/${JANA.id}`]: () => {
				members = [ADMIN_MEMBER, { ...JANA, role: PROJECT_ROLE.VISITOR }]
				return { status: 200, data: { ...JANA, role: PROJECT_ROLE.VISITOR } }
			},
		})
		renderApp(PAGE_PATH)

		// The table renders the role twice: in the Rola column and, for narrow screens (hidden by CSS otherwise), under the email.
		const [select] = await screen.findAllByRole('combobox', { name: `Rola používateľa ${JANA.email} v projekte` })
		expect(select).toHaveValue('Editor')
		fireEvent.click(select as HTMLElement)
		fireEvent.click(await screen.findByRole('option', { name: 'Návštevník' }))

		await waitFor(() => expect(screen.getAllByRole('combobox', { name: `Rola používateľa ${JANA.email} v projekte` })[0]).toHaveValue('Návštevník'))
		const patches = requests.filter((request) => request.method === 'patch')
		expect(patches).toHaveLength(1)
		expect(JSON.parse(patches[0]?.data as string)).toEqual({ role: 'VISITOR' })
		expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'green', message: 'Rola v projekte bola uložená.' }))
	})

	it('links an admin from every row to the user detail, which links back to this project', async () => {
		signedInAs(
			ADMIN_USER,
			routes(() => [ADMIN_MEMBER, JANA]),
		)
		renderApp(PAGE_PATH)

		const link = await screen.findByRole('link', { name: `Otvoriť používateľa ${JANA.email}` })
		expect(link).toHaveAttribute('href', `/admin/users/${JANA.id}?from=${PROJECT.slug}`)
		expect(screen.getByRole('link', { name: `Otvoriť používateľa ${ADMIN_MEMBER.email}` })).toHaveAttribute(
			'href',
			`/admin/users/${ADMIN_MEMBER.id}?from=${PROJECT.slug}`,
		)
	})

	it('offers an admin only the users who are neither members yet nor admins', async () => {
		const otherAdmin: AdminUser = { ...NEW_USER, email: 'druhy.admin@firma.sk', role: ROLE.ADMIN }
		const requests = signedInAs(
			ADMIN_USER,
			routes(
				() => [ADMIN_MEMBER, JANA],
				() => [ADMIN_SELF, otherAdmin, JANA_USER, PETER_USER],
			),
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
		fireEvent.click(within(dialog).getByRole('combobox', { name: 'Rola v projekte' }))
		fireEvent.click(await screen.findByRole('option', { name: 'Správca' }))
		expect(within(dialog).getByRole('combobox', { name: 'Rola v projekte' })).toHaveAccessibleDescription(
			'Spravuje projekt: nastavenia, jazyky, verzie, import a kľúče. Členov nespravuje.',
		)
		submitAdd(dialog)

		expect(await screen.findByText('Peter Malý')).toBeInTheDocument()
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
		const post = requests.find((request) => request.method === 'post')
		expect(JSON.parse(post?.data as string)).toEqual({ userId: PETER.id, role: 'MANAGER' })
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

	it('creates a new user from the modal with the role Používateľ and preselects them', async () => {
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
			[`POST ${MEMBERS_URL}`]: { status: 201, data: { ...NEW_USER, firstName: null, lastName: null, projectCount: 1 } },
		})
		renderApp(PAGE_PATH)
		const addDialog = await openAddModal()
		await within(addDialog).findByLabelText('Používateľ', { selector: 'input' })

		fireEvent.click(within(addDialog).getByRole('button', { name: 'Vytvoriť nového používateľa' }))
		const createDialog = await screen.findByRole('dialog', { name: 'Nový používateľ' })
		expect(within(createDialog).getByRole('switch', { name: /^Administrátor/ })).not.toBeChecked()
		fireEvent.change(within(createDialog).getByLabelText('E-mail'), { target: { value: NEW_USER.email } })
		fireEvent.change(within(createDialog).getByLabelText('Heslo'), { target: { value: 'NewMemberPassword1' } })
		fireEvent.click(within(createDialog).getByRole('button', { name: 'Vytvoriť používateľa' }))

		await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Nový používateľ' })).not.toBeInTheDocument())
		const createPost = requests.find((request) => request.method === 'post' && request.url === '/admin/users')
		expect(JSON.parse(createPost?.data as string)).toEqual({ email: NEW_USER.email, password: 'NewMemberPassword1', role: 'USER' })
		expect(getUserInput(addDialog)).toHaveValue(NEW_USER.email)

		submitAdd(addDialog)
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
		const addPost = requests.find((request) => request.method === 'post' && request.url === MEMBERS_URL)
		expect(JSON.parse(addPost?.data as string)).toEqual({ userId: NEW_USER.id, role: 'EDITOR' })
		await waitFor(() => expect(screen.getByRole('button', { name: 'Pridať člena' })).toHaveFocus())
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

	it('shows a server error as a notification and keeps the row', async () => {
		const show = vi.spyOn(notifications, 'show')
		signedInAs(ADMIN_USER, { ...routes(() => [JANA, PETER]), [`DELETE ${MEMBERS_URL}/${PETER.id}`]: apiError(500, 'INTERNAL_ERROR') })
		renderApp(PAGE_PATH)

		fireEvent.click(await screen.findByRole('button', { name: `Odobrať ${PETER.email} z projektu` }))
		fireEvent.click(within(await screen.findByRole('dialog', { name: 'Odobrať z projektu' })).getByRole('button', { name: 'Odobrať' }))

		await waitFor(() =>
			expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'red', message: 'Nastala neočakávaná chyba. Skúste to znova.' })),
		)
		expect(screen.getByText('Peter Malý')).toBeInTheDocument()
	})
})
