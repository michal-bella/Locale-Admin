import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'

import { type ProjectSettings } from '@locale/shared'

import { ADMIN_USER, EDITOR_USER, projectListRoute, signedInAs, VISITOR_USER } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'

const PROJECT: ProjectSettings = {
	id: '00000000-0000-4000-8000-000000000301',
	name: 'Booking Web',
	slug: 'booking-web',
	primaryColor: '#E83E8C',
	protectVariables: true,
	baseLanguageId: null,
}

const findNavigation = async () => within(await screen.findByRole('navigation', { name: 'Hlavná navigácia' }))

describe('Sidebar', () => {
	it('shows Všetky projekty and, under SPRÁVA, Projekty and Používatelia to an ADMIN outside a project', async () => {
		signedInAs(ADMIN_USER)
		renderApp('/profile')
		const navigation = await findNavigation()

		expect(navigation.getByRole('link', { name: 'Všetky projekty' })).toHaveAttribute('href', '/')
		const admin = within(navigation.getByRole('list', { name: 'Správa' }))
		expect(admin.getAllByRole('link').map((link) => link.textContent)).toEqual(['Projekty', 'Používatelia'])
		expect(admin.getByRole('link', { name: 'Projekty' })).toHaveAttribute('href', '/admin/projects')
		expect(admin.getByRole('link', { name: 'Používatelia' })).toHaveAttribute('href', '/admin/users')
		expect(within(screen.getByRole('complementary')).getByText('Locale')).toBeInTheDocument()
	})

	it('shows only Všetky projekty and no SPRÁVA label to an EDITOR outside a project', async () => {
		signedInAs(EDITOR_USER)
		renderApp('/profile')
		const navigation = await findNavigation()

		expect(navigation.getAllByRole('link').map((link) => link.textContent)).toEqual(['Všetky projekty'])
		expect(navigation.queryByText('Správa')).not.toBeInTheDocument()
	})

	it('shows the project name with Preklady first, Prehľad second, then História, Nastavenia, Jazyky, Verzie and Členovia inside a project', async () => {
		signedInAs(EDITOR_USER, {
			[`GET /projects/${PROJECT.id}/settings`]: { status: 200, data: PROJECT },
			[`GET /projects/${PROJECT.id}/languages`]: { status: 200, data: [] },
			...projectListRoute(PROJECT),
		})
		renderApp(`/projects/${PROJECT.slug}/settings`)
		const navigation = await findNavigation()

		const project = within(await navigation.findByRole('list', { name: 'Booking Web' }))
		expect(project.getAllByRole('link').map((link) => link.textContent)).toEqual([
			'Preklady',
			'Prehľad',
			'História',
			'Nastavenia',
			'Jazyky',
			'Verzie',
			'Členovia',
		])
		expect(project.getByRole('link', { name: 'Preklady' })).toHaveAttribute('href', `/projects/${PROJECT.slug}/translations`)
		expect(project.getByRole('link', { name: 'Prehľad' })).toHaveAttribute('href', `/projects/${PROJECT.slug}/dashboard`)
		expect(project.getByRole('link', { name: 'História' })).toHaveAttribute('href', `/projects/${PROJECT.slug}/history`)
		expect(project.getByRole('link', { name: 'Jazyky' })).toHaveAttribute('href', `/projects/${PROJECT.slug}/languages`)
		expect(project.getByRole('link', { name: 'Verzie' })).toHaveAttribute('href', `/projects/${PROJECT.slug}/versions`)
		expect(project.getByRole('link', { name: 'Členovia' })).toHaveAttribute('href', `/projects/${PROJECT.slug}/members`)
		await waitFor(() => expect(project.getByRole('link', { name: 'Nastavenia' })).toHaveAttribute('aria-current', 'page'))
		expect(navigation.queryByText('Správa')).not.toBeInTheDocument()
	})

	it('shows only Preklady, Prehľad and História to a VISITOR inside a project', async () => {
		signedInAs(VISITOR_USER, {
			[`GET /projects/${PROJECT.id}/settings`]: { status: 200, data: PROJECT },
			[`GET /projects/${PROJECT.id}/languages`]: { status: 200, data: [] },
			...projectListRoute(PROJECT),
		})
		renderApp(`/projects/${PROJECT.slug}/translations`)

		const navigation = await findNavigation()
		const project = within(await navigation.findByRole('list', { name: 'Booking Web' }))
		expect(project.getAllByRole('link').map((link) => link.textContent)).toEqual(['Preklady', 'Prehľad', 'História'])
		expect(navigation.queryByText('Správa')).not.toBeInTheDocument()
	})

	it('passes the current project to the SPRÁVA links, which then link back to it instead of to Všetky projekty', async () => {
		signedInAs(ADMIN_USER, {
			[`GET /projects/${PROJECT.id}/settings`]: { status: 200, data: PROJECT },
			[`GET /projects/${PROJECT.id}/languages`]: { status: 200, data: [] },
			...projectListRoute(PROJECT),
		})
		renderApp(`/projects/${PROJECT.slug}/settings`)
		const inProject = await findNavigation()

		const adminInProject = within(await inProject.findByRole('list', { name: 'Správa' }))
		await waitFor(() => expect(adminInProject.getByRole('link', { name: 'Projekty' })).toHaveAttribute('href', `/admin/projects?from=${PROJECT.slug}`))
		fireEvent.click(adminInProject.getByRole('link', { name: 'Používatelia' }))

		const navigation = await findNavigation()
		expect(await navigation.findByRole('link', { name: 'Späť na projekt' })).toHaveAttribute('href', `/projects/${PROJECT.slug}`)
		expect(navigation.queryByRole('link', { name: 'Všetky projekty' })).not.toBeInTheDocument()
		const admin = within(navigation.getByRole('list', { name: 'Správa' }))
		expect(admin.getByRole('link', { name: 'Projekty' })).toHaveAttribute('href', `/admin/projects?from=${PROJECT.slug}`)
	})

	it('keeps Všetky projekty on an admin page opened without a valid project', async () => {
		signedInAs(ADMIN_USER)
		renderApp('/admin/users?from=Not%20a%20slug')
		const navigation = await findNavigation()

		expect(await navigation.findByRole('link', { name: 'Všetky projekty' })).toHaveAttribute('href', '/')
		expect(navigation.queryByRole('link', { name: 'Späť na projekt' })).not.toBeInTheDocument()
	})

	it('switches projects from the switcher and keeps the current page', async () => {
		const other = { ...PROJECT, id: '00000000-0000-4000-8000-000000000302', name: 'Demo project', slug: 'demo-project', primaryColor: '#FACC15' }
		signedInAs(EDITOR_USER, {
			[`GET /projects/${PROJECT.id}/settings`]: { status: 200, data: PROJECT },
			[`GET /projects/${other.id}/settings`]: { status: 200, data: other },
			[`GET /projects/${PROJECT.id}/members`]: { status: 200, data: { members: [] } },
			[`GET /projects/${other.id}/members`]: { status: 200, data: { members: [] } },
			...projectListRoute(PROJECT, other),
		})
		const router = renderApp(`/projects/${PROJECT.slug}/members`)
		const switcher = await screen.findByRole('button', { name: 'Prepnúť projekt, aktuálny Booking Web' })

		expect(switcher).toHaveTextContent('BWBooking Webbooking-web')
		expect((await findNavigation()).queryByRole('link', { name: 'Všetky projekty' })).not.toBeInTheDocument()

		fireEvent.click(switcher)
		const menu = within(await screen.findByRole('menu'))
		expect(menu.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['BWBooking Web', 'DPDemo project', 'Všetky projekty'])
		expect(menu.getByRole('menuitem', { name: /Booking Web/ })).toHaveAttribute('aria-current', 'true')
		fireEvent.click(menu.getByRole('menuitem', { name: /Demo project/ }))

		await waitFor(() => expect(router.state.location.pathname).toBe(`/projects/${other.slug}/members`))
		expect(await screen.findByRole('button', { name: 'Prepnúť projekt, aktuálny Demo project' })).toBeInTheDocument()
	})

	it.each(['translations', 'languages'])('keeps /%s when switching projects', async (subPage) => {
		const other = { ...PROJECT, id: '00000000-0000-4000-8000-000000000302', name: 'Demo project', slug: 'demo-project', primaryColor: '#FACC15' }
		signedInAs(EDITOR_USER, {
			[`GET /projects/${PROJECT.id}/settings`]: { status: 200, data: PROJECT },
			[`GET /projects/${other.id}/settings`]: { status: 200, data: other },
			[`GET /projects/${PROJECT.id}/languages`]: { status: 200, data: [] },
			[`GET /projects/${other.id}/languages`]: { status: 200, data: [] },
			...projectListRoute(PROJECT, other),
		})
		const router = renderApp(`/projects/${PROJECT.slug}/${subPage}`)

		fireEvent.click(await screen.findByRole('button', { name: 'Prepnúť projekt, aktuálny Booking Web' }))
		fireEvent.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: /Demo project/ }))

		await waitFor(() => expect(router.state.location.pathname).toBe(`/projects/${other.slug}/${subPage}`))
	})

	it('opens Preklady when switching projects from Nastavenia', async () => {
		const other = { ...PROJECT, id: '00000000-0000-4000-8000-000000000302', name: 'Demo project', slug: 'demo-project', primaryColor: '#FACC15' }
		signedInAs(EDITOR_USER, {
			[`GET /projects/${PROJECT.id}/settings`]: { status: 200, data: PROJECT },
			[`GET /projects/${other.id}/settings`]: { status: 200, data: other },
			[`GET /projects/${PROJECT.id}/languages`]: { status: 200, data: [] },
			[`GET /projects/${other.id}/languages`]: { status: 200, data: [] },
			...projectListRoute(PROJECT, other),
		})
		const router = renderApp(`/projects/${PROJECT.slug}/settings`)

		fireEvent.click(await screen.findByRole('button', { name: 'Prepnúť projekt, aktuálny Booking Web' }))
		fireEvent.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: /Demo project/ }))

		await waitFor(() => expect(router.state.location.pathname).toBe(`/projects/${other.slug}/translations`))
	})

	it('marks the item of the current route as the current page', async () => {
		signedInAs(ADMIN_USER, { 'GET /admin/users': { status: 200, data: { users: [] } } })
		const router = renderApp('/profile')
		const navigation = await findNavigation()

		expect(navigation.getByRole('link', { name: 'Používatelia' })).not.toHaveAttribute('aria-current')
		expect(navigation.getByRole('link', { name: 'Všetky projekty' })).not.toHaveAttribute('aria-current')

		fireEvent.click(navigation.getByRole('link', { name: 'Používatelia' }))

		await waitFor(() => expect(router.state.location.pathname).toBe('/admin/users'))
		await waitFor(() => expect(navigation.getByRole('link', { name: 'Používatelia' })).toHaveAttribute('aria-current', 'page'))
		expect(navigation.getByRole('link', { name: 'Všetky projekty' })).not.toHaveAttribute('aria-current')
	})

	it('opens and closes on narrow screens with the burgers', async () => {
		signedInAs(ADMIN_USER)
		renderApp('/profile')
		const openButton = await screen.findByRole('button', { name: 'Otvoriť navigáciu' })
		const sidebar = screen.getByRole('complementary')

		expect(openButton).toHaveAttribute('aria-expanded', 'false')
		expect(openButton).toHaveAttribute('aria-controls', sidebar.id)
		expect(sidebar).toHaveAttribute('data-collapsed')

		fireEvent.click(openButton)
		expect(openButton).toHaveAttribute('aria-expanded', 'true')
		expect(sidebar).not.toHaveAttribute('data-collapsed')

		fireEvent.click(within(sidebar).getByRole('button', { name: 'Zavrieť navigáciu' }))
		expect(sidebar).toHaveAttribute('data-collapsed')
	})

	it('links the logo to the home page and closes the sidebar on narrow screens', async () => {
		signedInAs(ADMIN_USER)
		const router = renderApp('/profile')
		fireEvent.click(await screen.findByRole('button', { name: 'Otvoriť navigáciu' }))
		const sidebar = screen.getByRole('complementary')
		const home = within(sidebar).getByRole('link', { name: 'Locale – domovská stránka' })

		expect(home).toHaveAttribute('href', '/')
		expect(sidebar).not.toHaveAttribute('data-collapsed')

		fireEvent.click(home)

		await waitFor(() => expect(router.state.location.pathname).toBe('/'))
		expect(sidebar).toHaveAttribute('data-collapsed')
	})

	it('moves focus to the top-bar burger when the narrow-screen sidebar closes, since the closed sidebar is hidden', async () => {
		signedInAs(ADMIN_USER, { 'GET /admin/users': { status: 200, data: { users: [] } } })
		const router = renderApp('/profile')
		const openButton = await screen.findByRole('button', { name: 'Otvoriť navigáciu' })
		const sidebar = screen.getByRole('complementary')

		fireEvent.click(openButton)
		const closeButton = within(sidebar).getByRole('button', { name: 'Zavrieť navigáciu' })
		closeButton.focus()
		fireEvent.click(closeButton)
		expect(openButton).toHaveFocus()

		fireEvent.click(openButton)
		const link = within(sidebar).getByRole('link', { name: 'Používatelia' })
		link.focus()
		fireEvent.click(link)
		await waitFor(() => expect(router.state.location.pathname).toBe('/admin/users'))
		expect(sidebar).toHaveAttribute('data-collapsed')
		expect(openButton).toHaveFocus()
	})

	it('collapses to icons with the labels kept for screen readers, remembers it, and shows the labels in the opened narrow-screen sidebar', async () => {
		signedInAs(ADMIN_USER, { 'GET /admin/users': { status: 200, data: { users: [] } } })
		renderApp('/profile')
		const navigation = await findNavigation()
		const sidebar = screen.getByRole('complementary')
		expect(sidebar).not.toHaveAttribute('data-compact')

		fireEvent.click(within(sidebar).getByRole('button', { name: 'Zbaliť menu' }))

		expect(sidebar).toHaveAttribute('data-compact')
		expect(within(sidebar).getByRole('button', { name: 'Rozbaliť menu' })).toHaveAttribute('aria-expanded', 'false')
		expect(within(sidebar).queryByText('Locale')).not.toBeInTheDocument()
		const admin = within(navigation.getByRole('list', { name: 'Správa' }))
		expect(admin.getAllByRole('link').map((link) => link.textContent)).toEqual(['Projekty', 'Používatelia'])
		expect(localStorage.getItem('locale-sidebar-compact')).toBe('true')

		cleanup()
		renderApp('/profile')
		await findNavigation()
		const remembered = screen.getByRole('complementary')
		expect(remembered).toHaveAttribute('data-compact')

		fireEvent.click(await screen.findByRole('button', { name: 'Otvoriť navigáciu' }))
		expect(remembered).not.toHaveAttribute('data-compact')
		expect(within(remembered).getByText('Locale')).toBeInTheDocument()
	})
})
