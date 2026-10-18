import { notifications } from '@mantine/notifications'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { type AxiosAdapter } from 'axios'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vite-plus/test'

import { type AdminProjectListItem, type Language, type ProjectSettings, SUPPORTED_LANGUAGES } from '@locale/shared'

import http from '@/api/http'
import queryClient from '@/api/queryClient'
import { QUERY_KEYS } from '@/api/queryKeys'
import i18n from '@/lib/i18n'
import { ADMIN_USER, apiError, projectListRoute, signedInAs } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'

const PAGE_PATH = '/admin/projects'

const B2B: AdminProjectListItem = {
	id: '00000000-0000-4000-8000-000000000701',
	name: 'B2B Admin',
	slug: 'b2b-admin',
	primaryColor: '#E83E8C',
	baseLanguageTag: 'sk',
	languageCount: 3,
	memberCount: 5,
	createdAt: '2026-10-12T10:00:00.000Z',
}

const EMPTY_PROJECT: AdminProjectListItem = {
	id: '00000000-0000-4000-8000-000000000702',
	name: 'Web URLs',
	slug: 'web-urls',
	primaryColor: '#FACC15',
	baseLanguageTag: null,
	languageCount: 0,
	memberCount: 1,
	createdAt: '2026-10-03T10:00:00.000Z',
}

const SLOVAK: Language = {
	id: '00000000-0000-4000-8000-000000000711',
	...(SUPPORTED_LANGUAGES.find(({ tag }) => tag === 'sk') as (typeof SUPPORTED_LANGUAGES)[number]),
	isBase: true,
	createdAt: '2026-10-12T10:00:00.000Z',
}

const B2B_SETTINGS: ProjectSettings = {
	id: B2B.id,
	name: B2B.name,
	slug: B2B.slug,
	primaryColor: B2B.primaryColor,
	protectVariables: true,
	baseLanguageId: SLOVAK.id,
}

const SETTINGS_URL = `/projects/${B2B.id}/settings`

const listResponse = (projects: AdminProjectListItem[]) => ({ status: 200, data: { projects } })

const editRoutes = {
	[`GET ${SETTINGS_URL}`]: { status: 200, data: B2B_SETTINGS },
	[`GET /projects/${B2B.id}/languages`]: { status: 200, data: [SLOVAK] },
}

const getTable = () => screen.getByRole('table', { name: 'Zoznam projektov' })

const adminListGets = (requests: { method?: string; url?: string }[]) =>
	requests.filter((request) => request.method === 'get' && request.url === '/admin/projects').length

const openEdit = async () => {
	fireEvent.click(await screen.findByRole('button', { name: `Upraviť projekt ${B2B.name}` }))
	const dialog = await screen.findByRole('dialog', { name: 'Upraviť projekt' })
	await within(dialog).findByLabelText('Názov projektu')
	return dialog
}

const openDelete = async () => {
	fireEvent.click(await screen.findByRole('button', { name: `Zmazať projekt ${B2B.name}` }))
	return screen.findByRole('dialog', { name: 'Zmazať projekt' })
}

const typeSlug = (dialog: HTMLElement, value: string) =>
	fireEvent.change(within(dialog).getByLabelText(`Pre potvrdenie napíšte slug projektu ${B2B.slug}`), { target: { value } })

beforeAll(() => {
	// The global 3 retries with backoff would delay the error state by seconds.
	queryClient.setQueryDefaults(QUERY_KEYS.ADMIN.PROJECTS(), { retry: false })
	queryClient.setQueryDefaults(QUERY_KEYS.PROJECTS.SETTINGS(B2B.id), { retry: false })
	queryClient.setQueryDefaults(QUERY_KEYS.PROJECTS.LANGUAGES(B2B.id), { retry: false })
})

afterEach(() => {
	vi.restoreAllMocks()
})

describe('AdminProjectsPage table', () => {
	it('renders a row per project with color, slug, base language, counts and date', async () => {
		signedInAs(ADMIN_USER, { 'GET /admin/projects': listResponse([B2B, EMPTY_PROJECT]) })
		renderApp(PAGE_PATH)

		expect(await screen.findByText(B2B.name)).toBeInTheDocument()
		expect(screen.getByRole('heading', { level: 1, name: 'Projekty' })).toBeInTheDocument()
		const table = getTable()
		expect(
			within(table)
				.getAllByRole('columnheader')
				.map((header) => header.textContent),
		).toEqual(['Projekt', 'Slug', 'Základný jazyk', 'Jazyky', 'Členovia', 'Vytvorený', 'Akcie'])
		const [b2bRow, emptyRow] = within(table).getAllByRole('row').slice(1) as [HTMLElement, HTMLElement]
		expect(
			within(b2bRow)
				.getAllByRole('cell')
				.map((cell) => cell.textContent),
		).toEqual(['BAB2B Admin', 'b2b-admin', 'Slovak', '3', '5', '12. 10. 2026', ''])
		expect(b2bRow.querySelector('[data-flag="sk"]')).toBeInTheDocument()
		expect(within(emptyRow).getByText('Bez jazyka')).toBeInTheDocument()
		expect(within(emptyRow).getByText('3. 10. 2026')).toBeInTheDocument()
		expect(within(b2bRow).getByRole('button', { name: 'Upraviť projekt B2B Admin' })).toBeInTheDocument()
		expect(within(b2bRow).getByRole('link', { name: 'Otvoriť projekt B2B Admin' })).toHaveAttribute('href', `/projects/${B2B.slug}/settings`)
		expect(within(b2bRow).getByRole('button', { name: 'Zmazať projekt B2B Admin' })).toBeInTheDocument()
	})

	it('formats dates in en', async () => {
		await i18n.changeLanguage('en')
		signedInAs(ADMIN_USER, { 'GET /admin/projects': listResponse([B2B]) })
		renderApp(PAGE_PATH)

		expect(await screen.findByText('12/10/2026')).toBeInTheDocument()
		expect(screen.getByRole('table', { name: 'Project list' })).toBeInTheDocument()
	})

	it('shows skeleton rows while loading', async () => {
		signedInAs(ADMIN_USER)
		const adapter = http.defaults.adapter as AxiosAdapter
		http.defaults.adapter = (config) => (config.url === '/admin/projects' ? new Promise(() => undefined) : adapter(config))
		renderApp(PAGE_PATH)

		await screen.findByRole('heading', { level: 1, name: 'Projekty' })
		expect(getTable()).toHaveAttribute('aria-busy', 'true')
		expect(within(getTable()).getAllByRole('row').slice(1)).toHaveLength(3)
	})

	it('shows the empty state', async () => {
		signedInAs(ADMIN_USER, { 'GET /admin/projects': listResponse([]) })
		renderApp(PAGE_PATH)

		expect(await screen.findByText('Zatiaľ tu nie sú žiadne projekty.')).toBeInTheDocument()
		expect(getTable()).toHaveAttribute('aria-busy', 'false')
	})

	it('shows the translated load error and retries', async () => {
		let backendUp = false
		signedInAs(ADMIN_USER, {
			'GET /admin/projects': () => (backendUp ? listResponse([B2B]) : apiError(500, 'INTERNAL_ERROR')),
		})
		renderApp(PAGE_PATH)

		expect(await screen.findByText('Zoznam projektov sa nepodarilo načítať.')).toBeInTheDocument()
		expect(screen.getByText('Nastala neočakávaná chyba. Skúste to znova.')).toBeInTheDocument()
		expect(screen.queryByText('English message that must not be shown')).not.toBeInTheDocument()

		backendUp = true
		fireEvent.click(screen.getByRole('button', { name: 'Skúsiť znova' }))

		expect(await screen.findByText(B2B.name)).toBeInTheDocument()
		await waitFor(() => expect(getTable()).toHaveFocus())
	})

	it('opens the create project modal', async () => {
		signedInAs(ADMIN_USER, { 'GET /admin/projects': listResponse([B2B]) })
		renderApp(PAGE_PATH)

		fireEvent.click(await screen.findByRole('button', { name: 'Nový projekt' }))

		expect(await screen.findByRole('dialog', { name: 'Nový projekt' })).toBeInTheDocument()
	})

	it('opens the settings page of the project', async () => {
		signedInAs(ADMIN_USER, { 'GET /admin/projects': listResponse([B2B]), ...editRoutes, ...projectListRoute({ ...B2B, isMember: false }) })
		const router = renderApp(PAGE_PATH)

		fireEvent.click(await screen.findByRole('link', { name: 'Otvoriť projekt B2B Admin' }))

		await waitFor(() => expect(router.state.location.pathname).toBe(`/projects/${B2B.slug}/settings`))
		expect(await screen.findByRole('heading', { level: 1, name: 'Nastavenia projektu' })).toBeInTheDocument()
	})
})

describe('EditProjectModal', () => {
	it('prefills the settings form without Opustiť projekt', async () => {
		signedInAs(ADMIN_USER, { 'GET /admin/projects': listResponse([B2B]), ...editRoutes })
		renderApp(PAGE_PATH)
		const dialog = await openEdit()

		expect(within(dialog).getByText(B2B.name)).toBeInTheDocument()
		expect(within(dialog).getByLabelText('Názov projektu')).toHaveValue(B2B.name)
		expect(within(dialog).getByLabelText('Slug projektu')).toHaveValue(B2B.slug)
		expect(within(dialog).getByRole('button', { name: 'Uložiť zmeny' })).toBeDisabled()
		expect(within(dialog).queryByRole('button', { name: 'Opustiť projekt' })).not.toBeInTheDocument()
	})

	it('focuses Názov projektu when it opens, also with cached data, and returns focus to the trigger', async () => {
		signedInAs(ADMIN_USER, { 'GET /admin/projects': listResponse([B2B]), ...editRoutes })
		renderApp(PAGE_PATH)
		// fireEvent.click does not move focus like a real click or Enter does.
		const trigger = await screen.findByRole('button', { name: `Upraviť projekt ${B2B.name}` })
		trigger.focus()
		const dialog = await openEdit()

		await waitFor(() => expect(within(dialog).getByLabelText('Názov projektu')).toHaveFocus())

		fireEvent.click(within(dialog).getByRole('button', { name: 'Zrušiť' }))
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
		await waitFor(() => expect(trigger).toHaveFocus())

		const reopened = await openEdit()
		await waitFor(() => expect(within(reopened).getByLabelText('Názov projektu')).toHaveFocus())
	})

	it('shows the load error in the modal and retries', async () => {
		let backendUp = false
		signedInAs(ADMIN_USER, {
			'GET /admin/projects': listResponse([B2B]),
			...editRoutes,
			[`GET ${SETTINGS_URL}`]: () => (backendUp ? { status: 200, data: B2B_SETTINGS } : apiError(500, 'INTERNAL_ERROR')),
		})
		renderApp(PAGE_PATH)
		fireEvent.click(await screen.findByRole('button', { name: `Upraviť projekt ${B2B.name}` }))
		const dialog = await screen.findByRole('dialog', { name: 'Upraviť projekt' })

		expect(await within(dialog).findByText('Nastavenia projektu sa nepodarilo načítať.')).toBeInTheDocument()

		backendUp = true
		fireEvent.click(within(dialog).getByRole('button', { name: 'Skúsiť znova' }))

		expect(await within(dialog).findByLabelText('Názov projektu')).toHaveValue(B2B.name)
		await waitFor(() => expect(within(dialog).getByLabelText('Názov projektu')).toHaveFocus())
	})

	it('maps 409 SLUG_TAKEN to the slug field and keeps the modal open', async () => {
		signedInAs(ADMIN_USER, { 'GET /admin/projects': listResponse([B2B]), ...editRoutes, [`PATCH ${SETTINGS_URL}`]: apiError(409, 'SLUG_TAKEN') })
		renderApp(PAGE_PATH)
		const dialog = await openEdit()

		fireEvent.change(within(dialog).getByLabelText('Slug projektu'), { target: { value: 'b2c-ios' } })
		fireEvent.click(within(dialog).getByRole('button', { name: 'Uložiť zmeny' }))

		expect(await within(dialog).findByText('Projekt s týmto slugom už existuje.')).toBeInTheDocument()
		expect(within(dialog).getByLabelText('Slug projektu')).toHaveFocus()
		expect(screen.getByRole('dialog', { name: 'Upraviť projekt' })).toBeInTheDocument()
	})

	it('saves, closes the modal, stays on the page and refetches the list', async () => {
		const show = vi.spyOn(notifications, 'show')
		let projects = [B2B]
		const requests = signedInAs(ADMIN_USER, {
			'GET /admin/projects': () => listResponse(projects),
			...editRoutes,
			[`PATCH ${SETTINGS_URL}`]: () => {
				projects = [{ ...B2B, name: 'B2C iOS', slug: 'b2c-ios' }]
				return { status: 200, data: { ...B2B_SETTINGS, name: 'B2C iOS', slug: 'b2c-ios' } }
			},
		})
		const router = renderApp(PAGE_PATH)
		const dialog = await openEdit()

		fireEvent.change(within(dialog).getByLabelText('Názov projektu'), { target: { value: 'B2C iOS' } })
		fireEvent.change(within(dialog).getByLabelText('Slug projektu'), { target: { value: 'b2c-ios' } })
		fireEvent.click(within(dialog).getByRole('button', { name: 'Uložiť zmeny' }))

		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
		expect(await within(getTable()).findByText('B2C iOS')).toBeInTheDocument()
		expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'green', message: 'Nastavenia projektu boli uložené.' }))
		expect(adminListGets(requests)).toBe(2)
		// The slug change must not send the admin to the settings URL like the settings page does.
		expect(router.state.location.pathname).toBe(PAGE_PATH)
	})

	it('cannot be closed while saving', async () => {
		signedInAs(ADMIN_USER, { 'GET /admin/projects': listResponse([B2B]), ...editRoutes })
		const adapter = http.defaults.adapter as AxiosAdapter
		http.defaults.adapter = (config) => (config.method === 'patch' ? new Promise(() => undefined) : adapter(config))
		renderApp(PAGE_PATH)
		const dialog = await openEdit()

		fireEvent.change(within(dialog).getByLabelText('Názov projektu'), { target: { value: 'B2C iOS' } })
		fireEvent.click(within(dialog).getByRole('button', { name: 'Uložiť zmeny' }))

		await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Zavrieť' })).toBeDisabled())
		expect(within(dialog).getByRole('button', { name: 'Zrušiť' })).toBeDisabled()
		fireEvent.keyDown(dialog, { key: 'Escape' })
		expect(screen.getByRole('dialog', { name: 'Upraviť projekt' })).toBeInTheDocument()
	})

	it('drops unsaved changes on Zrušiť without a request', async () => {
		const requests = signedInAs(ADMIN_USER, { 'GET /admin/projects': listResponse([B2B]), ...editRoutes })
		renderApp(PAGE_PATH)
		const dialog = await openEdit()

		fireEvent.change(within(dialog).getByLabelText('Názov projektu'), { target: { value: 'Changed' } })
		fireEvent.click(within(dialog).getByRole('button', { name: 'Zrušiť' }))

		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
		expect(requests.some((request) => request.method === 'patch')).toBe(false)
		const reopened = await openEdit()
		expect(within(reopened).getByLabelText('Názov projektu')).toHaveValue(B2B.name)
	})
})

describe('DeleteProjectModal', () => {
	it('enables Zmazať projekt only after the exact slug is typed, deletes and drops the row', async () => {
		const show = vi.spyOn(notifications, 'show')
		let projects = [B2B, EMPTY_PROJECT]
		const requests = signedInAs(ADMIN_USER, {
			'GET /admin/projects': () => listResponse(projects),
			[`DELETE /admin/projects/${B2B.id}`]: () => {
				projects = [EMPTY_PROJECT]
				return { status: 204 }
			},
		})
		renderApp(PAGE_PATH)
		const dialog = await openDelete()
		const confirm = within(dialog).getByRole('button', { name: 'Zmazať projekt' })

		expect(within(dialog).getByText(/Naozaj chcete zmazať projekt B2B Admin\? Zmažú sa aj všetky jeho jazyky a členstvá/)).toBeInTheDocument()
		expect(confirm).toBeDisabled()
		typeSlug(dialog, 'b2b-admi')
		expect(confirm).toBeDisabled()
		typeSlug(dialog, 'B2B-ADMIN')
		expect(confirm).toBeDisabled()
		typeSlug(dialog, B2B.slug)
		expect(confirm).toBeEnabled()

		fireEvent.click(confirm)

		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
		await waitFor(() => expect(within(getTable()).queryByText(B2B.name)).not.toBeInTheDocument())
		expect(requests.filter((request) => request.method === 'delete')).toHaveLength(1)
		expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'green', message: 'Projekt B2B Admin bol zmazaný.' }))
	})

	it('clears the typed slug when closed', async () => {
		signedInAs(ADMIN_USER, { 'GET /admin/projects': listResponse([B2B]) })
		renderApp(PAGE_PATH)
		const dialog = await openDelete()

		typeSlug(dialog, B2B.slug)
		fireEvent.click(within(dialog).getByRole('button', { name: 'Zrušiť' }))
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

		const reopened = await openDelete()
		expect(within(reopened).getByLabelText(`Pre potvrdenie napíšte slug projektu ${B2B.slug}`)).toHaveValue('')
		expect(within(reopened).getByRole('button', { name: 'Zmazať projekt' })).toBeDisabled()
	})

	it('on 404 notifies, closes and refreshes the list', async () => {
		const show = vi.spyOn(notifications, 'show')
		let projects = [B2B]
		const requests = signedInAs(ADMIN_USER, {
			'GET /admin/projects': () => listResponse(projects),
			[`DELETE /admin/projects/${B2B.id}`]: () => {
				projects = []
				return apiError(404, 'NOT_FOUND')
			},
		})
		renderApp(PAGE_PATH)
		const dialog = await openDelete()

		typeSlug(dialog, B2B.slug)
		fireEvent.click(within(dialog).getByRole('button', { name: 'Zmazať projekt' }))

		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
		expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'red', message: 'Požadovaný záznam sa nenašiel.' }))
		expect(await screen.findByText('Zatiaľ tu nie sú žiadne projekty.')).toBeInTheDocument()
		expect(adminListGets(requests)).toBe(2)
	})
})
