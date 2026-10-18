import { notifications } from '@mantine/notifications'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import { type ProjectMember, type ProjectSettings } from '@locale/shared'

import { apiError, EDITOR_USER, projectListRoute, signedInAs } from '@/test/mockApi'
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

const NEW_MEMBER: ProjectMember = {
	id: '00000000-0000-4000-8000-000000000502',
	email: 'nova@firma.sk',
	firstName: null,
	lastName: null,
	createdAt: '2026-10-18T10:00:00.000Z',
}

const MEMBERS_URL = `/projects/${PROJECT.id}/members`

const PAGE_PATH = `/projects/${PROJECT.slug}/members`

const routes = (members: () => ProjectMember[]) => ({
	...projectListRoute(PROJECT),
	[`GET /projects/${PROJECT.id}/settings`]: { status: 200, data: PROJECT },
	[`GET ${MEMBERS_URL}`]: () => ({ status: 200, data: { members: members() } }),
})

const openModal = async () => {
	fireEvent.click(await screen.findByRole('button', { name: 'Pridať člena' }))
	return within(await screen.findByRole('dialog', { name: 'Nový člen' }))
}

const fillAndSubmit = (dialog: Awaited<ReturnType<typeof openModal>>, email: string, password: string) => {
	fireEvent.change(dialog.getByLabelText('E-mail'), { target: { value: email } })
	fireEvent.change(dialog.getByLabelText('Heslo'), { target: { value: password } })
	fireEvent.click(dialog.getByRole('button', { name: 'Pridať člena' }))
}

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

	it('creates a member, closes the modal, refetches the list and notifies', async () => {
		const show = vi.spyOn(notifications, 'show')
		let members = [JANA]
		const requests = signedInAs(EDITOR_USER, {
			...routes(() => members),
			[`POST ${MEMBERS_URL}`]: () => {
				members = [JANA, NEW_MEMBER]
				return { status: 201, data: NEW_MEMBER }
			},
		})
		renderApp(PAGE_PATH)

		fillAndSubmit(await openModal(), ' Nova@Firma.sk ', 'NewMemberPassword1')

		expect(await screen.findByText('nova@firma.sk')).toBeInTheDocument()
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
		const post = requests.find((request) => request.method === 'post')
		expect(JSON.parse(post?.data as string)).toEqual({ email: 'nova@firma.sk', password: 'NewMemberPassword1' })
		expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'green', message: 'Člen nova@firma.sk bol pridaný do projektu.' }))
	})

	it('shows 409 EMAIL_TAKEN at the email field and keeps the modal open', async () => {
		signedInAs(EDITOR_USER, { ...routes(() => [JANA]), [`POST ${MEMBERS_URL}`]: apiError(409, 'EMAIL_TAKEN') })
		renderApp(PAGE_PATH)
		const dialog = await openModal()

		fillAndSubmit(dialog, 'jana.novakova@firma.sk', 'NewMemberPassword1')

		expect(await dialog.findByText('Používateľ s týmto e-mailom už existuje.')).toBeInTheDocument()
		expect(dialog.getByLabelText('E-mail')).toHaveAttribute('aria-invalid', 'true')
	})

	it('shows client validation errors without sending a request', async () => {
		const requests = signedInAs(
			EDITOR_USER,
			routes(() => [JANA]),
		)
		renderApp(PAGE_PATH)
		const dialog = await openModal()

		fillAndSubmit(dialog, 'not-an-email', 'short')

		expect(await dialog.findByText('Zadajte platný e-mail.')).toBeInTheDocument()
		expect(requests.some((request) => request.method === 'post')).toBe(false)
	})
})

describe('RemoveMemberModal', () => {
	const OTHER: ProjectMember = { ...NEW_MEMBER, firstName: 'Peter', lastName: 'Malý' }

	it('offers no remove for the own row', async () => {
		signedInAs(
			EDITOR_USER,
			routes(() => [JANA, OTHER]),
		)
		renderApp(PAGE_PATH)

		expect(await screen.findByRole('button', { name: `Odobrať ${OTHER.email} z projektu` })).toBeInTheDocument()
		expect(screen.queryByRole('button', { name: `Odobrať ${JANA.email} z projektu` })).not.toBeInTheDocument()
	})

	it('removes a member after confirmation and refetches the list', async () => {
		const show = vi.spyOn(notifications, 'show')
		let members = [JANA, OTHER]
		const requests = signedInAs(EDITOR_USER, {
			...routes(() => members),
			[`DELETE ${MEMBERS_URL}/${OTHER.id}`]: () => {
				members = [JANA]
				return { status: 204 }
			},
		})
		renderApp(PAGE_PATH)

		fireEvent.click(await screen.findByRole('button', { name: `Odobrať ${OTHER.email} z projektu` }))
		const dialog = await screen.findByRole('dialog', { name: 'Odobrať z projektu' })
		expect(dialog).toHaveTextContent(`Naozaj chcete odobrať ${OTHER.email} z projektu?`)
		fireEvent.click(within(dialog).getByRole('button', { name: 'Odobrať' }))

		await waitFor(() => expect(screen.queryByText('Peter Malý')).not.toBeInTheDocument())
		expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'green', message: `${OTHER.email} bol odobraný z projektu.` }))
		expect(requests.filter((request) => request.method === 'delete')).toHaveLength(1)
	})

	it('shows LAST_MEMBER as a notification and keeps the row', async () => {
		const show = vi.spyOn(notifications, 'show')
		signedInAs(EDITOR_USER, { ...routes(() => [JANA, OTHER]), [`DELETE ${MEMBERS_URL}/${OTHER.id}`]: apiError(409, 'LAST_MEMBER') })
		renderApp(PAGE_PATH)

		fireEvent.click(await screen.findByRole('button', { name: `Odobrať ${OTHER.email} z projektu` }))
		fireEvent.click(within(await screen.findByRole('dialog', { name: 'Odobrať z projektu' })).getByRole('button', { name: 'Odobrať' }))

		await waitFor(() => expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'red', message: 'Projekt musí mať aspoň jedného člena.' })))
		expect(screen.getByText('Peter Malý')).toBeInTheDocument()
	})
})
