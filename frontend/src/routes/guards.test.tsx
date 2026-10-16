import { screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vite-plus/test'

import http from '@/api/http'
import queryClient from '@/api/queryClient'
import { installUnauthorizedInterceptor } from '@/api/unauthorizedInterceptor'
import { ADMIN_USER, apiError, EDITOR_USER, signedInAs, signedOut } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'

describe('route guards', () => {
	it('sends an anonymous user from / to /login', async () => {
		signedOut()
		const router = renderApp('/')

		expect(await screen.findByRole('heading', { level: 1, name: 'Vitajte späť' })).toBeInTheDocument()
		expect(router.state.location.pathname).toBe('/login')
		expect(router.state.location.search).toEqual({})
	})

	it('sends a signed-in user from /login to /', async () => {
		signedInAs(EDITOR_USER)
		const router = renderApp('/login')

		expect(await screen.findByRole('button', { name: 'Menu používateľa' })).toBeInTheDocument()
		expect(router.state.location.pathname).toBe('/')
	})

	it('shows the 403 page to an EDITOR on /admin/users and keeps the URL', async () => {
		signedInAs(EDITOR_USER)
		const router = renderApp('/admin/users')

		expect(await screen.findByRole('heading', { level: 1, name: 'Prístup zamietnutý' })).toBeInTheDocument()
		expect(screen.getByRole('link', { name: 'Späť na úvod' })).toHaveAttribute('href', '/')
		expect(router.state.location.pathname).toBe('/admin/users')
	})

	it('shows the users page to an ADMIN', async () => {
		signedInAs(ADMIN_USER)
		renderApp('/admin/users')

		expect(await screen.findByRole('heading', { level: 1, name: 'Používatelia' })).toBeInTheDocument()
	})

	it('keeps the 404 page for unknown routes', async () => {
		signedOut()
		renderApp('/does-not-exist')

		expect(await screen.findByRole('heading', { level: 1, name: 'Stránka sa nenašla' })).toBeInTheDocument()
	})
})

describe('401 interceptor', () => {
	let interceptorId: number | undefined

	afterEach(() => {
		if (interceptorId !== undefined) {
			http.interceptors.response.eject(interceptorId)
		}
	})

	it('clears the user and goes to /login when a request returns 401 during use', async () => {
		let sessionValid = true
		signedInAs(ADMIN_USER, {
			'GET /auth/me': () => (sessionValid ? { status: 200, data: ADMIN_USER } : apiError(401, 'AUTH_UNAUTHENTICATED')),
			'GET /health': apiError(401, 'AUTH_UNAUTHENTICATED'),
		})
		const router = renderApp('/')
		interceptorId = installUnauthorizedInterceptor({ router, queryClient })
		await screen.findByRole('button', { name: 'Menu používateľa' })

		sessionValid = false
		await http.get('/health').catch(() => undefined)

		await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
		expect(await screen.findByRole('heading', { level: 1, name: 'Vitajte späť' })).toBeInTheDocument()
	})
})
