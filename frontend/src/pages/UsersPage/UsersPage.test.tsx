import { notifications } from '@mantine/notifications'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { type AxiosAdapter } from 'axios'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vite-plus/test'

import { type AdminUser, ROLE } from '@locale/shared'

import http from '@/api/http'
import queryClient from '@/api/queryClient'
import { QUERY_KEYS } from '@/api/queryKeys'
import i18n from '@/lib/i18n'
import { ADMIN_USER, apiError, signedInAs } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'

const MARTIN: AdminUser = {
	id: '00000000-0000-4000-8000-000000000011',
	email: 'martin.kovac@firma.sk',
	role: ROLE.ADMIN,
	createdAt: '2026-10-12T10:00:00.000Z',
}

const JANA: AdminUser = {
	id: '00000000-0000-4000-8000-000000000012',
	email: 'jana.novakova@firma.sk',
	role: ROLE.EDITOR,
	createdAt: '2026-10-03T10:00:00.000Z',
}

const NEW_USER: AdminUser = {
	id: '00000000-0000-4000-8000-000000000013',
	email: 'nova@firma.sk',
	role: ROLE.EDITOR,
	createdAt: '2026-10-16T10:00:00.000Z',
}

const usersResponse = (users: AdminUser[]) => ({ status: 200, data: { users } })

const getTable = () => screen.getByRole('table', { name: 'Zoznam administrátorov' })

const openModal = async () => {
	fireEvent.click(await screen.findByRole('button', { name: 'Vytvoriť administrátora' }))
	return screen.findByRole('dialog', { name: 'Nový administrátor' })
}

const fillAndSubmit = (dialog: HTMLElement, email: string, password: string) => {
	fireEvent.change(within(dialog).getByLabelText('E-mail'), { target: { value: email } })
	fireEvent.change(within(dialog).getByLabelText('Heslo'), { target: { value: password } })
	const submit = within(dialog).getByRole('button', { name: 'Vytvoriť administrátora' })
	// fireEvent.click does not move focus like a real click or Enter does.
	submit.focus()
	fireEvent.click(submit)
}

/** POST /admin/users never resolves; returns the list of POST requests sent. */
const mockPendingCreate = () => {
	signedInAs(ADMIN_USER, { 'GET /admin/users': usersResponse([JANA]) })
	const adapter = http.defaults.adapter as AxiosAdapter
	const posts: unknown[] = []
	http.defaults.adapter = (config) => {
		if (config.method === 'post' && config.url === '/admin/users') {
			posts.push(config)
			return new Promise(() => undefined)
		}
		return adapter(config)
	}
	return posts
}

beforeAll(() => {
	// The global 3 retries with backoff would delay the error state by seconds.
	queryClient.setQueryDefaults(QUERY_KEYS.ADMIN.USERS(), { retry: false })
})

afterEach(() => {
	vi.restoreAllMocks()
})

describe('UsersPage table', () => {
	it('renders rows with email initials and dates in sk', async () => {
		signedInAs(ADMIN_USER, { 'GET /admin/users': usersResponse([MARTIN, JANA]) })
		renderApp('/admin/users')

		expect(await screen.findByText(MARTIN.email)).toBeInTheDocument()
		const table = getTable()
		expect(within(table).getByRole('columnheader', { name: 'E-mail' })).toBeInTheDocument()
		expect(within(table).getByRole('columnheader', { name: 'Vytvorený' })).toBeInTheDocument()
		const rows = within(table).getAllByRole('row').slice(1)
		expect(rows).toHaveLength(2)
		const [martinRow, janaRow] = rows as [HTMLElement, HTMLElement]
		expect(within(martinRow).getByText('MA')).toBeInTheDocument()
		// Decorative: the email next to it is the row's name for screen readers.
		expect(within(martinRow).getByRole('cell', { name: MARTIN.email })).toBeInTheDocument()
		expect(within(martinRow).getByText('12. 10. 2026')).toBeInTheDocument()
		expect(within(janaRow).getByText('JA')).toBeInTheDocument()
		expect(within(janaRow).getByText(JANA.email)).toBeInTheDocument()
		expect(within(janaRow).getByText('3. 10. 2026')).toBeInTheDocument()
	})

	it('formats dates in en', async () => {
		await i18n.changeLanguage('en')
		signedInAs(ADMIN_USER, { 'GET /admin/users': usersResponse([MARTIN, JANA]) })
		renderApp('/admin/users')

		expect(await screen.findByText('12/10/2026')).toBeInTheDocument()
		expect(screen.getByText('03/10/2026')).toBeInTheDocument()
		expect(screen.getByRole('columnheader', { name: 'Created' })).toBeInTheDocument()
	})

	it('shows skeleton rows while loading', async () => {
		signedInAs(ADMIN_USER)
		const adapter = http.defaults.adapter as AxiosAdapter
		http.defaults.adapter = (config) => (config.url === '/admin/users' ? new Promise(() => undefined) : adapter(config))
		renderApp('/admin/users')

		await screen.findByRole('heading', { level: 1, name: 'Používatelia' })
		expect(getTable()).toHaveAttribute('aria-busy', 'true')
		expect(within(getTable()).getAllByRole('row').slice(1)).toHaveLength(3)
	})

	it('shows the empty state', async () => {
		signedInAs(ADMIN_USER, { 'GET /admin/users': usersResponse([]) })
		renderApp('/admin/users')

		expect(await screen.findByText('Zatiaľ tu nie sú žiadni administrátori.')).toBeInTheDocument()
		expect(getTable()).toHaveAttribute('aria-busy', 'false')
	})

	it('shows the translated load error and retries', async () => {
		let backendUp = false
		signedInAs(ADMIN_USER, {
			'GET /admin/users': () => (backendUp ? usersResponse([JANA]) : apiError(500, 'INTERNAL_ERROR')),
		})
		renderApp('/admin/users')

		expect(await screen.findByText('Zoznam administrátorov sa nepodarilo načítať.')).toBeInTheDocument()
		expect(screen.getByText('Nastala neočakávaná chyba. Skúste to znova.')).toBeInTheDocument()
		expect(screen.queryByText('English message that must not be shown')).not.toBeInTheDocument()

		backendUp = true
		const retry = screen.getByRole('button', { name: 'Skúsiť znova' })
		retry.focus()
		fireEvent.click(retry)

		expect(await screen.findByText(JANA.email)).toBeInTheDocument()
		await waitFor(() => expect(getTable()).toHaveFocus())
	})
})

describe('CreateUserModal', () => {
	it('shows client validation errors at the fields without sending a request', async () => {
		const requests = signedInAs(ADMIN_USER, { 'GET /admin/users': usersResponse([JANA]) })
		renderApp('/admin/users')
		const dialog = await openModal()

		expect(within(dialog).getByLabelText('Heslo')).toHaveAttribute('placeholder', 'Min. 8 znakov')
		fillAndSubmit(dialog, 'not-an-email', 'short')

		expect(await within(dialog).findByText('Zadajte platný e-mail.')).toBeInTheDocument()
		expect(within(dialog).getByText('Zadajte aspoň 8 znakov.')).toBeInTheDocument()
		expect(requests.some((request) => request.method === 'post')).toBe(false)
	})

	it('maps 400 details to the fields', async () => {
		signedInAs(ADMIN_USER, {
			'GET /admin/users': usersResponse([JANA]),
			'POST /admin/users': apiError(400, 'VALIDATION_ERROR', {
				details: [
					{ path: 'email', code: 'INVALID_EMAIL' },
					{ path: 'password', code: 'TOO_SHORT', params: { min: 8 } },
				],
			}),
		})
		renderApp('/admin/users')
		const dialog = await openModal()

		fillAndSubmit(dialog, 'nova@firma.sk', 'long-enough-password')

		expect(await within(dialog).findByText('Zadajte platný e-mail.')).toBeInTheDocument()
		expect(within(dialog).getByText('Zadajte aspoň 8 znakov.')).toBeInTheDocument()
		expect(within(dialog).getByLabelText('E-mail')).toHaveFocus()
	})

	it('shows 409 EMAIL_TAKEN at the email field and keeps the modal open', async () => {
		signedInAs(ADMIN_USER, {
			'GET /admin/users': usersResponse([JANA]),
			'POST /admin/users': apiError(409, 'EMAIL_TAKEN'),
		})
		renderApp('/admin/users')
		const dialog = await openModal()

		fillAndSubmit(dialog, 'Jana.Novakova@firma.sk', 'long-enough-password')

		expect(await within(dialog).findByText('Používateľ s týmto e-mailom už existuje.')).toBeInTheDocument()
		expect(within(dialog).getByLabelText('E-mail')).toHaveAttribute('aria-invalid', 'true')
		expect(within(dialog).getByLabelText('E-mail')).toHaveFocus()
		expect(screen.getByRole('dialog')).toBeInTheDocument()
	})

	it('shows other errors as a notification', async () => {
		const show = vi.spyOn(notifications, 'show')
		signedInAs(ADMIN_USER, {
			'GET /admin/users': usersResponse([JANA]),
			'POST /admin/users': apiError(500, 'INTERNAL_ERROR'),
		})
		renderApp('/admin/users')
		const dialog = await openModal()

		fillAndSubmit(dialog, 'nova@firma.sk', 'long-enough-password')

		await waitFor(() =>
			expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'red', message: 'Nastala neočakávaná chyba. Skúste to znova.' })),
		)
		expect(screen.getByRole('dialog')).toBeInTheDocument()
	})

	it('creates the user, closes the modal, refetches the list and notifies', async () => {
		const show = vi.spyOn(notifications, 'show')
		let users = [JANA]
		const requests = signedInAs(ADMIN_USER, {
			'GET /admin/users': () => usersResponse(users),
			'POST /admin/users': () => {
				users = [NEW_USER, ...users]
				return { status: 201, data: NEW_USER }
			},
		})
		renderApp('/admin/users')
		await screen.findByText(JANA.email)
		const dialog = await openModal()

		fillAndSubmit(dialog, '  Nova@Firma.sk ', 'long-enough-password')

		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
		expect(await screen.findByText(NEW_USER.email)).toBeInTheDocument()
		const posts = requests.filter((request) => request.method === 'post' && request.url === '/admin/users')
		expect(posts).toHaveLength(1)
		expect(JSON.parse(posts[0]?.data as string)).toEqual({ email: 'nova@firma.sk', password: 'long-enough-password' })
		expect(requests.filter((request) => request.method === 'get' && request.url === '/admin/users')).toHaveLength(2)
		expect(show).toHaveBeenCalledWith(expect.objectContaining({ message: 'Administrátor nova@firma.sk bol vytvorený.' }))

		const reopened = await openModal()
		expect(within(reopened).getByLabelText('E-mail')).toHaveValue('')
	})

	it('sends one request when the form is submitted twice while pending', async () => {
		const posts = mockPendingCreate()
		renderApp('/admin/users')
		const dialog = await openModal()

		fillAndSubmit(dialog, 'nova@firma.sk', 'long-enough-password')
		const submit = within(dialog).getByRole('button', { name: 'Vytvoriť administrátora' })
		await waitFor(() => expect(submit).toHaveAttribute('data-loading', 'true'))
		expect(submit).toBeDisabled()

		const form = submit.closest('form')
		expect(form).not.toBeNull()
		fireEvent.submit(form as HTMLFormElement)
		fireEvent.click(submit)

		await waitFor(() => expect(posts).toHaveLength(1))
		await new Promise((resolve) => setTimeout(resolve, 50))
		expect(posts).toHaveLength(1)
	})

	it('cannot be closed while the request is pending', async () => {
		mockPendingCreate()
		renderApp('/admin/users')
		const dialog = await openModal()

		fillAndSubmit(dialog, 'nova@firma.sk', 'long-enough-password')
		const cancel = within(dialog).getByRole('button', { name: 'Zrušiť' })
		await waitFor(() => expect(cancel).toBeDisabled())
		expect(within(dialog).getByRole('button', { name: 'Zavrieť' })).toBeDisabled()

		fireEvent.keyDown(dialog, { key: 'Escape' })
		fireEvent.click(cancel)

		expect(screen.getByRole('dialog', { name: 'Nový administrátor' })).toBeInTheDocument()
		expect(within(dialog).getByLabelText('E-mail')).toHaveValue('nova@firma.sk')
	})

	it('resets the form on cancel', async () => {
		signedInAs(ADMIN_USER, { 'GET /admin/users': usersResponse([JANA]) })
		renderApp('/admin/users')
		const dialog = await openModal()

		fireEvent.change(within(dialog).getByLabelText('E-mail'), { target: { value: 'draft@firma.sk' } })
		fireEvent.click(within(dialog).getByRole('button', { name: 'Zrušiť' }))
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

		const reopened = await openModal()
		expect(within(reopened).getByLabelText('E-mail')).toHaveValue('')
	})
})

describe('DeleteAdminModal', () => {
	const SELF: AdminUser = { id: ADMIN_USER.id, email: ADMIN_USER.email, role: ROLE.ADMIN, createdAt: '2026-10-01T10:00:00.000Z' }

	it('offers no delete for the own row', async () => {
		signedInAs(ADMIN_USER, { 'GET /admin/users': usersResponse([MARTIN, SELF]) })
		renderApp('/admin/users')

		expect(await screen.findByRole('button', { name: `Akcie administrátora ${MARTIN.email}` })).toBeInTheDocument()
		expect(screen.queryByRole('button', { name: `Akcie administrátora ${SELF.email}` })).not.toBeInTheDocument()
	})

	it('deletes an admin after confirmation, refetches the list and focuses the table', async () => {
		const show = vi.spyOn(notifications, 'show')
		let users = [MARTIN, SELF]
		const requests = signedInAs(ADMIN_USER, {
			'GET /admin/users': () => usersResponse(users),
			[`DELETE /admin/users/${MARTIN.id}`]: () => {
				users = [SELF]
				return { status: 204 }
			},
		})
		renderApp('/admin/users')

		fireEvent.click(await screen.findByRole('button', { name: `Akcie administrátora ${MARTIN.email}` }))
		fireEvent.click(await screen.findByRole('menuitem', { name: 'Odstrániť' }))
		const dialog = await screen.findByRole('dialog', { name: 'Odstrániť administrátora' })
		expect(dialog).toHaveTextContent(`Naozaj chcete odstrániť účet ${MARTIN.email}?`)
		fireEvent.click(within(dialog).getByRole('button', { name: 'Odstrániť' }))

		await waitFor(() => expect(within(getTable()).queryByText(MARTIN.email)).not.toBeInTheDocument())
		expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'green', message: `Administrátor ${MARTIN.email} bol odstránený.` }))
		expect(requests.filter((request) => request.method === 'delete')).toHaveLength(1)
		await waitFor(() => expect(getTable()).toHaveFocus())
	})

	it('cancel sends nothing', async () => {
		const requests = signedInAs(ADMIN_USER, { 'GET /admin/users': usersResponse([MARTIN, SELF]) })
		renderApp('/admin/users')

		fireEvent.click(await screen.findByRole('button', { name: `Akcie administrátora ${MARTIN.email}` }))
		fireEvent.click(await screen.findByRole('menuitem', { name: 'Odstrániť' }))
		fireEvent.click(within(await screen.findByRole('dialog', { name: 'Odstrániť administrátora' })).getByRole('button', { name: 'Zrušiť' }))

		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
		expect(requests.some((request) => request.method === 'delete')).toBe(false)
	})
})
