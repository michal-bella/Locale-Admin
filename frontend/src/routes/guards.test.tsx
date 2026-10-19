import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vite-plus/test'

import http from '@/api/http'
import queryClient from '@/api/queryClient'
import { installUnauthorizedInterceptor } from '@/api/unauthorizedInterceptor'
import { ADMIN_USER, apiError, EDITOR_USER, mockApi, projectListRoute, signedInAs, signedOut } from '@/test/mockApi'
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

	it('shows the 403 page to an EDITOR on /admin/projects and keeps the URL', async () => {
		const requests = signedInAs(EDITOR_USER)
		const router = renderApp('/admin/projects')

		expect(await screen.findByRole('heading', { level: 1, name: 'Prístup zamietnutý' })).toBeInTheDocument()
		expect(router.state.location.pathname).toBe('/admin/projects')
		expect(requests.some((request) => request.url === '/admin/projects')).toBe(false)
	})

	it('shows the 404 page on the removed /languages', async () => {
		signedInAs(ADMIN_USER)
		renderApp('/languages')

		expect(await screen.findByRole('heading', { level: 1, name: 'Stránka sa nenašla' })).toBeInTheDocument()
	})

	it('redirects a project URL to its translations', async () => {
		const project = { id: '00000000-0000-4000-8000-000000000601', name: 'Booking Web', slug: 'booking-web', primaryColor: '#E83E8C' }
		signedInAs(EDITOR_USER, {
			...projectListRoute(project),
			[`GET /projects/${project.id}/settings`]: { status: 200, data: { ...project, protectVariables: true, baseLanguageId: null } },
			[`GET /projects/${project.id}/languages`]: { status: 200, data: [] },
		})
		const router = renderApp(`/projects/${project.slug}`)

		expect(await screen.findByRole('heading', { level: 1, name: 'Preklady' })).toBeInTheDocument()
		expect(router.state.location.pathname).toBe(`/projects/${project.slug}/translations`)
	})

	it('shows the users page to an ADMIN', async () => {
		signedInAs(ADMIN_USER)
		renderApp('/admin/users')

		expect(await screen.findByRole('heading', { level: 1, name: 'Používatelia' })).toBeInTheDocument()
	})

	it('shows the login form on /login at once when /auth/me fails with 500', async () => {
		const requests = mockApi({ 'GET /auth/me': apiError(500, 'INTERNAL_ERROR') })
		const router = renderApp('/login')

		expect(await screen.findByRole('heading', { level: 1, name: 'Vitajte späť' })).toBeInTheDocument()
		expect(router.state.location.pathname).toBe('/login')
		expect(requests.filter((request) => request.url === '/auth/me')).toHaveLength(1)
	})

	it('shows the translated error page on / when /auth/me fails with 500 and retries on demand', async () => {
		let backendUp = false
		const requests = mockApi({
			'GET /auth/me': () => (backendUp ? { status: 200, data: EDITOR_USER } : apiError(500, 'INTERNAL_ERROR')),
		})
		renderApp('/')

		expect(await screen.findByRole('heading', { level: 1, name: 'Niečo sa pokazilo' })).toBeInTheDocument()
		expect(screen.getByText('Nastala neočakávaná chyba. Skúste to znova.')).toBeInTheDocument()
		expect(screen.getByRole('link', { name: 'Späť na úvod' })).toHaveAttribute('href', '/')
		expect(screen.queryByText(/English message that must not be shown|Something went wrong/)).not.toBeInTheDocument()
		expect(requests.filter((request) => request.url === '/auth/me')).toHaveLength(1)

		backendUp = true
		fireEvent.click(screen.getByRole('button', { name: 'Skúsiť znova' }))

		expect(await screen.findByRole('button', { name: 'Menu používateľa' })).toBeInTheDocument()
	})

	it('shows errors.UNKNOWN on the error page when the backend is unreachable', async () => {
		mockApi({ 'GET /auth/me': { status: 502, data: '<html>Bad Gateway</html>' } })
		renderApp('/')

		expect(await screen.findByRole('heading', { level: 1, name: 'Niečo sa pokazilo' })).toBeInTheDocument()
		expect(screen.getByText('Nastala neznáma chyba. Skúste to znova.')).toBeInTheDocument()
	})

	it('keeps the 404 page for unknown routes', async () => {
		signedOut()
		renderApp('/does-not-exist')

		expect(await screen.findByRole('heading', { level: 1, name: 'Stránka sa nenašla' })).toBeInTheDocument()
	})
})

const PREVIOUS_USER_DATA_KEY = ['test', 'previous-user-data']

describe('401 interceptor', () => {
	let interceptorId: number | undefined

	afterEach(() => {
		if (interceptorId !== undefined) {
			http.interceptors.response.eject(interceptorId)
		}
	})

	it('clears the whole cache and goes to /login when a request returns 401 during use', async () => {
		let sessionValid = true
		signedInAs(ADMIN_USER, {
			'GET /auth/me': () => (sessionValid ? { status: 200, data: ADMIN_USER } : apiError(401, 'AUTH_UNAUTHENTICATED')),
			'GET /health': apiError(401, 'AUTH_UNAUTHENTICATED'),
		})
		const router = renderApp('/')
		interceptorId = installUnauthorizedInterceptor({ router, queryClient })
		await screen.findByRole('button', { name: 'Menu používateľa' })
		queryClient.setQueryData(PREVIOUS_USER_DATA_KEY, ['data of the previous user'])

		sessionValid = false
		await http.get('/health').catch(() => undefined)

		await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
		expect(await screen.findByRole('heading', { level: 1, name: 'Vitajte späť' })).toBeInTheDocument()
		expect(queryClient.getQueryData(PREVIOUS_USER_DATA_KEY)).toBeUndefined()
	})
})
