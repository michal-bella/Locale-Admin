import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'

import queryClient from '@/api/queryClient'
import { ADMIN_USER, apiError, EDITOR_USER, signedInAs } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'

const PREVIOUS_USER_DATA_KEY = ['test', 'previous-user-data']

const getTopBar = async () => within(await screen.findByRole('banner'))

const openMenu = async () => fireEvent.click(await screen.findByRole('button', { name: /^Menu používateľa/ }))

describe('UserMenu', () => {
	it('shows initials, full name and role of an ADMIN in the top bar', async () => {
		signedInAs(ADMIN_USER)
		renderApp('/profile')
		const topBar = await getTopBar()

		expect(await topBar.findByText('MK')).toBeInTheDocument()
		expect(topBar.getByText('Martin Kováč')).toBeInTheDocument()
		expect(topBar.getByText('Administrátor')).toBeInTheDocument()
		expect(topBar.getByRole('button', { name: /^Menu používateľa/ })).toBeInTheDocument()
	})

	it('shows the email instead of a missing name and the USER role', async () => {
		signedInAs(EDITOR_USER)
		renderApp('/profile')
		const topBar = await getTopBar()

		expect(await topBar.findByText('JA')).toBeInTheDocument()
		expect(topBar.getByText(EDITOR_USER.email)).toBeInTheDocument()
		expect(topBar.getByText('Používateľ')).toBeInTheDocument()
	})

	it('has only the profile link and logout in the menu', async () => {
		signedInAs(ADMIN_USER)
		renderApp('/')
		await openMenu()

		const menu = within(await screen.findByRole('menu'))
		expect(menu.getByText(ADMIN_USER.email)).toBeInTheDocument()
		expect(menu.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Môj profil', 'Odhlásiť sa'])
		expect(menu.getByRole('menuitem', { name: 'Môj profil' })).toHaveAttribute('href', '/profile')
	})

	it('logs out and goes to /login', async () => {
		let sessionValid = true
		const requests = signedInAs(ADMIN_USER, {
			'GET /auth/me': () => (sessionValid ? { status: 200, data: ADMIN_USER } : apiError(401, 'AUTH_UNAUTHENTICATED')),
			'POST /auth/logout': () => {
				sessionValid = false
				return { status: 204 }
			},
		})
		const router = renderApp('/')
		await openMenu()
		queryClient.setQueryData(PREVIOUS_USER_DATA_KEY, ['data of the signed-out user'])

		fireEvent.click(await screen.findByRole('menuitem', { name: 'Odhlásiť sa' }))

		await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
		expect(await screen.findByRole('heading', { level: 1, name: 'Vitajte späť' })).toBeInTheDocument()
		expect(requests.some((request) => request.method === 'post' && request.url === '/auth/logout')).toBe(true)
		expect(queryClient.getQueryData(PREVIOUS_USER_DATA_KEY)).toBeUndefined()
	})
})
