import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'

import queryClient from '@/api/queryClient'
import { ADMIN_USER, apiError, EDITOR_USER, signedInAs } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'

const PREVIOUS_USER_DATA_KEY = ['test', 'previous-user-data']

const openMenu = async () => fireEvent.click(await screen.findByRole('button', { name: 'Menu používateľa' }))

describe('UserMenu', () => {
	it('shows initials, email and the users link for an ADMIN', async () => {
		signedInAs(ADMIN_USER)
		renderApp('/')

		expect(await screen.findByText('MK')).toBeInTheDocument()
		await openMenu()

		expect(await screen.findByText(ADMIN_USER.email)).toBeInTheDocument()
		expect(screen.getByRole('menuitem', { name: 'Používatelia' })).toHaveAttribute('href', '/admin/users')
		expect(screen.getByRole('menuitem', { name: 'Odhlásiť' })).toBeInTheDocument()
	})

	it('hides the users link for an EDITOR and uses email initials', async () => {
		signedInAs(EDITOR_USER)
		renderApp('/')

		expect(await screen.findByText('JA')).toBeInTheDocument()
		await openMenu()

		expect(await screen.findByRole('menuitem', { name: 'Odhlásiť' })).toBeInTheDocument()
		expect(screen.queryByRole('menuitem', { name: 'Používatelia' })).not.toBeInTheDocument()
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

		fireEvent.click(await screen.findByRole('menuitem', { name: 'Odhlásiť' }))

		await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
		expect(await screen.findByRole('heading', { level: 1, name: 'Vitajte späť' })).toBeInTheDocument()
		expect(requests.some((request) => request.method === 'post' && request.url === '/auth/logout')).toBe(true)
		expect(queryClient.getQueryData(PREVIOUS_USER_DATA_KEY)).toBeUndefined()
	})
})
