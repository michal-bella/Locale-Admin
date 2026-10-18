import { notifications } from '@mantine/notifications'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import { type ProjectMember, type ProjectSettings } from '@locale/shared'

import { apiError, EDITOR_USER, signedInAs } from '@/test/mockApi'
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

const routes = (members: () => ProjectMember[]) => ({
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
		renderApp(MEMBERS_URL)

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
		renderApp(MEMBERS_URL)

		fillAndSubmit(await openModal(), ' Nova@Firma.sk ', 'NewMemberPassword1')

		expect(await screen.findByText('nova@firma.sk')).toBeInTheDocument()
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
		const post = requests.find((request) => request.method === 'post')
		expect(JSON.parse(post?.data as string)).toEqual({ email: 'nova@firma.sk', password: 'NewMemberPassword1' })
		expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'green', message: 'Člen nova@firma.sk bol pridaný do projektu.' }))
	})

	it('shows 409 EMAIL_TAKEN at the email field and keeps the modal open', async () => {
		signedInAs(EDITOR_USER, { ...routes(() => [JANA]), [`POST ${MEMBERS_URL}`]: apiError(409, 'EMAIL_TAKEN') })
		renderApp(MEMBERS_URL)
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
		renderApp(MEMBERS_URL)
		const dialog = await openModal()

		fillAndSubmit(dialog, 'not-an-email', 'short')

		expect(await dialog.findByText('Zadajte platný e-mail.')).toBeInTheDocument()
		expect(requests.some((request) => request.method === 'post')).toBe(false)
	})
})
