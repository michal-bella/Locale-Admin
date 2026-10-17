import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'

import { ADMIN_USER, signedInAs } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'

describe('TopBar', () => {
	it('has the language and theme switchers and the bell, without the logo and the user menu', async () => {
		signedInAs(ADMIN_USER)
		renderApp('/')
		const topBar = within(await screen.findByRole('banner'))

		expect(topBar.getByRole('radiogroup', { name: 'Jazyk' })).toBeInTheDocument()
		expect(topBar.getByRole('button', { name: 'Prepnúť na tmavý režim' })).toBeInTheDocument()
		expect(topBar.getByRole('img', { name: 'Notifikácie' })).toBeInTheDocument()
		expect(topBar.queryByText('Locale')).not.toBeInTheDocument()
		expect(topBar.queryByRole('button', { name: 'Menu používateľa' })).not.toBeInTheDocument()
	})
})
