import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'

import { ADMIN_USER, signedInAs } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'

describe('TopBar', () => {
	it('has the language and theme switchers, without the logo and the user menu next to the sidebar', async () => {
		signedInAs(ADMIN_USER)
		renderApp('/profile')
		const topBar = within(await screen.findByRole('banner'))

		expect(topBar.getByRole('combobox', { name: 'Jazyk' })).toBeInTheDocument()
		expect(topBar.getByRole('button', { name: 'Prepnúť na tmavý režim' })).toBeInTheDocument()
		expect(topBar.queryByRole('img', { name: 'Notifikácie' })).not.toBeInTheDocument()
		expect(topBar.queryByText('Locale')).not.toBeInTheDocument()
		expect(topBar.queryByRole('button', { name: 'Menu používateľa' })).not.toBeInTheDocument()
	})

	it('shows the logo and the user menu without a burger on the project list, which has no sidebar', async () => {
		signedInAs(ADMIN_USER, { 'GET /projects': { status: 200, data: { projects: [] } } })
		renderApp('/')
		const topBar = within(await screen.findByRole('banner'))

		expect(topBar.getByRole('link', { name: 'Locale – domovská stránka' })).toHaveAttribute('href', '/')
		expect(topBar.getByRole('button', { name: 'Menu používateľa' })).toBeInTheDocument()
		expect(topBar.queryByRole('button', { name: 'Otvoriť navigáciu' })).not.toBeInTheDocument()
		expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
	})
})
