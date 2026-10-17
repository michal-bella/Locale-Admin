import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'

import i18n from '@/lib/i18n'
import { ADMIN_USER, signedInAs, signedOut } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'

describe('document.title', () => {
	it('names the login page', async () => {
		signedOut()
		renderApp('/login')

		await screen.findByRole('heading', { level: 1 })
		expect(document.title).toBe('Vitajte späť – Locale')
	})

	it('names the home page, which has a hidden h1', async () => {
		signedInAs(ADMIN_USER)
		renderApp('/')

		expect(await screen.findByRole('heading', { level: 1, name: 'Domov' })).toBeInTheDocument()
		expect(document.title).toBe('Domov – Locale')
	})

	it('follows navigation and the UI language', async () => {
		signedInAs(ADMIN_USER, { 'GET /admin/languages': { status: 200, data: [] }, 'GET /admin/users': { status: 200, data: { users: [] } } })
		renderApp('/languages')

		await waitFor(() => expect(document.title).toBe('Jazyky – Locale'))

		fireEvent.click(within(screen.getByRole('navigation', { name: 'Hlavná navigácia' })).getByRole('link', { name: 'Používatelia' }))
		await waitFor(() => expect(document.title).toBe('Používatelia – Locale'))

		await act(() => i18n.changeLanguage('en'))
		expect(document.title).toBe('Users – Locale')
	})
})
