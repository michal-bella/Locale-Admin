import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'

import { ADMIN_USER, EDITOR_USER, signedInAs } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'

const findNavigation = async () => within(await screen.findByRole('navigation', { name: 'Hlavná navigácia' }))

describe('Sidebar', () => {
	it('shows Jazyky and, under SPRÁVA, Používatelia to an ADMIN', async () => {
		signedInAs(ADMIN_USER)
		renderApp('/')
		const navigation = await findNavigation()

		expect(navigation.getByRole('link', { name: 'Jazyky' })).toHaveAttribute('href', '/languages')
		expect(navigation.getByRole('list', { name: 'Správa' })).toBeInTheDocument()
		expect(within(navigation.getByRole('list', { name: 'Správa' })).getByRole('link', { name: 'Používatelia' })).toHaveAttribute('href', '/admin/users')
		expect(within(screen.getByRole('complementary')).getByText('Locale')).toBeInTheDocument()
	})

	it('shows no items and no SPRÁVA label to an EDITOR', async () => {
		signedInAs(EDITOR_USER)
		renderApp('/')
		const navigation = await findNavigation()

		expect(navigation.queryAllByRole('link')).toHaveLength(0)
		expect(navigation.queryByText('Správa')).not.toBeInTheDocument()
	})

	it('marks the item of the current route as the current page', async () => {
		signedInAs(ADMIN_USER, { 'GET /admin/languages': { status: 200, data: [] } })
		const router = renderApp('/languages')
		const navigation = await findNavigation()

		await waitFor(() => expect(navigation.getByRole('link', { name: 'Jazyky' })).toHaveAttribute('aria-current', 'page'))
		expect(navigation.getByRole('link', { name: 'Používatelia' })).not.toHaveAttribute('aria-current')

		fireEvent.click(navigation.getByRole('link', { name: 'Používatelia' }))

		await waitFor(() => expect(router.state.location.pathname).toBe('/admin/users'))
		await waitFor(() => expect(navigation.getByRole('link', { name: 'Používatelia' })).toHaveAttribute('aria-current', 'page'))
		expect(navigation.getByRole('link', { name: 'Jazyky' })).not.toHaveAttribute('aria-current')
	})

	it('opens and closes on narrow screens with the burgers', async () => {
		signedInAs(ADMIN_USER)
		renderApp('/')
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
})
