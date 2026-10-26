import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'

import { ADMIN_USER, apiError, signedOut } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'

const fillAndSubmit = async (email: string, password: string) => {
	fireEvent.change(await screen.findByLabelText('E-mail'), { target: { value: email } })
	fireEvent.change(screen.getByLabelText('Heslo'), { target: { value: password } })
	fireEvent.click(screen.getByRole('button', { name: 'Prihlásiť sa' }))
}

describe('LoginPage', () => {
	it('shows translated field errors and sends nothing for an invalid form', async () => {
		const requests = signedOut()
		renderApp('/login')

		fireEvent.click(await screen.findByRole('button', { name: 'Prihlásiť sa' }))
		expect(await screen.findAllByText('Toto pole je povinné.')).toHaveLength(2)

		await fillAndSubmit('not-an-email', 'secret')
		expect(await screen.findByText('Zadajte platný e-mail.')).toBeInTheDocument()
		expect(requests.filter((request) => request.url === '/auth/login')).toHaveLength(0)
	})

	it('shows the translated 401 error, never the backend message', async () => {
		const requests = signedOut({ 'POST /auth/login': apiError(401, 'AUTH_INVALID_CREDENTIALS') })
		renderApp('/login')

		await fillAndSubmit(' Admin@Firma.sk ', 'wrong-password')

		expect(await screen.findByText('Nesprávny e-mail alebo heslo.')).toBeInTheDocument()
		expect(screen.queryByText(/English message/)).not.toBeInTheDocument()
		const login = requests.find((request) => request.url === '/auth/login')
		expect(JSON.parse(String(login?.data))).toEqual({ email: 'admin@firma.sk', password: 'wrong-password' })
	})

	it('shows the seconds from Retry-After on 429', async () => {
		signedOut({ 'POST /auth/login': apiError(429, 'RATE_LIMITED', { headers: { 'retry-after': '42' } }) })
		renderApp('/login')

		await fillAndSubmit('admin@firma.sk', 'secret')

		expect(await screen.findByText('Príliš veľa pokusov. Skúste to znova o 42 s.')).toBeInTheDocument()
	})

	it('maps VALIDATION_ERROR details to the fields', async () => {
		signedOut({ 'POST /auth/login': apiError(400, 'VALIDATION_ERROR', { details: [{ path: 'password', code: 'TOO_LONG', params: { max: 128 } }] }) })
		renderApp('/login')

		await fillAndSubmit('admin@firma.sk', 'secret')

		expect(await screen.findByText('Zadajte najviac 128 znakov.')).toBeInTheDocument()
		expect(screen.getByLabelText('Heslo')).toHaveFocus()
	})

	it('navigates to / after a successful login', async () => {
		signedOut({ 'POST /auth/login': { status: 200, data: ADMIN_USER } })
		const router = renderApp('/login')

		await fillAndSubmit('admin@firma.sk', 'secret')

		await waitFor(() => expect(router.state.location.pathname).toBe('/'))
		expect(await screen.findByRole('button', { name: /^Menu používateľa/ })).toBeInTheDocument()
	})

	it('offers Prihlásiť sa cez Google as a link to the backend when Google is on', async () => {
		signedOut({ 'GET /auth/providers': { status: 200, data: { google: true } } })
		renderApp('/login')

		const google = await screen.findByRole('link', { name: 'Prihlásiť sa cez Google' })
		expect(google).toHaveAttribute('href', '/api/auth/oauth/google')
		expect(screen.getByText('alebo')).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Prihlásiť sa' })).toBeInTheDocument()
	})

	it('shows no Google sign-in when it is off', async () => {
		signedOut({ 'GET /auth/providers': { status: 200, data: { google: false } } })
		renderApp('/login')

		expect(await screen.findByRole('button', { name: 'Prihlásiť sa' })).toBeInTheDocument()
		await waitFor(() => expect(screen.queryByRole('link', { name: 'Prihlásiť sa cez Google' })).not.toBeInTheDocument())
	})

	it('shows the translated error of a failed Google sign-in from the URL', async () => {
		signedOut({ 'GET /auth/providers': { status: 200, data: { google: true } } })
		renderApp('/login?error=AUTH_USER_BLOCKED')

		expect(await screen.findByText('Váš účet je zablokovaný. Obráťte sa na administrátora.')).toBeInTheDocument()
	})

	it('ignores an unknown error code in the URL', async () => {
		signedOut()
		renderApp('/login?error=SOMETHING_ELSE')

		expect(await screen.findByRole('button', { name: 'Prihlásiť sa' })).toBeInTheDocument()
		expect(screen.queryByText(/SOMETHING_ELSE/)).not.toBeInTheDocument()
		expect(screen.queryByText('Nastala neznáma chyba. Skúste to znova.')).not.toBeInTheDocument()
	})
})
