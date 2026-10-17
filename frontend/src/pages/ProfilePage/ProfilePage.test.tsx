import { notifications } from '@mantine/notifications'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { type AxiosAdapter } from 'axios'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vite-plus/test'

import { type AuthUser, type Profile } from '@locale/shared'

import http from '@/api/http'
import queryClient from '@/api/queryClient'
import { QUERY_KEYS } from '@/api/queryKeys'
import { LOCALE_STORAGE_KEY } from '@/lib/constants'
import i18n from '@/lib/i18n'
import { ADMIN_USER, apiError, EDITOR_USER, signedInAs } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000

const profileOf = (user: AuthUser): Profile => ({ ...user, passwordChangedAt: new Date(Date.now() - NINETY_DAYS_MS).toISOString() })

const ADMIN_PROFILE = profileOf(ADMIN_USER)

const getSaveButton = () => screen.getByRole('button', { name: 'Uložiť profil' })

const getMain = () => within(screen.getByRole('main'))

const getSidebar = () => within(screen.getByRole('complementary'))

const renderProfile = async () => {
	renderApp('/profile')
	return screen.findByLabelText('Meno')
}

const fillNames = (firstName: string, lastName: string) => {
	fireEvent.change(screen.getByLabelText('Meno'), { target: { value: firstName } })
	fireEvent.change(screen.getByLabelText('Priezvisko'), { target: { value: lastName } })
}

beforeAll(() => {
	// The global 3 retries with backoff would delay the error state by seconds.
	queryClient.setQueryDefaults(QUERY_KEYS.PROFILE(), { retry: false })
})

afterEach(() => {
	vi.restoreAllMocks()
})

describe('ProfilePage', () => {
	it('prefills the form and shows the saved profile in the card', async () => {
		signedInAs(ADMIN_USER, { 'GET /profile': { status: 200, data: ADMIN_PROFILE } })
		await renderProfile()

		expect(screen.getByRole('heading', { level: 1, name: 'Môj profil' })).toBeInTheDocument()
		expect(screen.getByLabelText('Meno')).toHaveValue('Martin')
		expect(screen.getByLabelText('Priezvisko')).toHaveValue('Kováč')
		expect(screen.getByRole('heading', { level: 2, name: 'Martin Kováč' })).toBeInTheDocument()
		expect(getMain().getByText('Administrátor')).toBeInTheDocument()
		expect(screen.getByText('Heslo bolo naposledy zmenené pred 3 mesiacmi.')).toBeInTheDocument()
	})

	it('shows the email as the name and empty fields when the user has no name', async () => {
		signedInAs(EDITOR_USER, { 'GET /profile': { status: 200, data: profileOf(EDITOR_USER) } })
		await renderProfile()

		expect(screen.getByLabelText('Meno')).toHaveValue('')
		expect(screen.getByLabelText('Priezvisko')).toHaveValue('')
		expect(screen.getByRole('heading', { level: 2, name: EDITOR_USER.email })).toBeInTheDocument()
		expect(getMain().getByText('Editor')).toBeInTheDocument()
	})

	it('shows the controls outside the MVP as disabled', async () => {
		signedInAs(ADMIN_USER, { 'GET /profile': { status: 200, data: ADMIN_PROFILE } })
		await renderProfile()

		expect(screen.getByLabelText('E-mailová adresa')).toBeDisabled()
		expect(screen.getByLabelText('E-mailová adresa')).toHaveValue(ADMIN_USER.email)
		expect(screen.getByLabelText('Pracovná pozícia')).toBeDisabled()
		expect(screen.getByLabelText('Pracovná pozícia')).toHaveValue('')
		expect(screen.getByLabelText('Pracovná pozícia')).toHaveAttribute('placeholder', 'Napr. Product manager')
		const switches = within(screen.getByRole('group', { name: 'E-mailové oznámenia' })).getAllByRole('switch')
		expect(switches).toHaveLength(3)
		switches.forEach((toggle) => {
			expect(toggle).toBeDisabled()
			expect(toggle).not.toBeChecked()
		})
		// Mantine renders the description inside the <label>, so it is part of the accessible name.
		expect(screen.getByRole('switch', { name: /^Zmienky a komentáre/ })).toHaveAccessibleDescription('Keď vás niekto označí pri preklade.')
		expect(screen.getByRole('button', { name: 'Zmeniť fotografiu' })).toBeDisabled()
		expect(screen.getByRole('button', { name: 'Zmeniť heslo' })).toBeDisabled()
	})

	it('enables Save only when the names change and keeps the card on the saved data', async () => {
		signedInAs(ADMIN_USER, { 'GET /profile': { status: 200, data: ADMIN_PROFILE } })
		await renderProfile()

		expect(getSaveButton()).toBeDisabled()
		fireEvent.change(screen.getByLabelText('Meno'), { target: { value: 'Peter' } })
		expect(getSaveButton()).toBeEnabled()
		expect(screen.getByRole('heading', { level: 2, name: 'Martin Kováč' })).toBeInTheDocument()

		fireEvent.change(screen.getByLabelText('Meno'), { target: { value: 'Martin' } })
		await waitFor(() => expect(getSaveButton()).toBeDisabled())
	})

	it('shows client validation errors at the fields without sending a request', async () => {
		const requests = signedInAs(ADMIN_USER, { 'GET /profile': { status: 200, data: ADMIN_PROFILE } })
		await renderProfile()

		fillNames('   ', 'x'.repeat(101))
		fireEvent.click(getSaveButton())

		expect(await screen.findByText('Toto pole je povinné.')).toBeInTheDocument()
		expect(screen.getByText('Zadajte najviac 100 znakov.')).toBeInTheDocument()
		expect(screen.getByLabelText('Meno')).toHaveAttribute('aria-invalid', 'true')
		expect(requests.some((request) => request.method === 'patch')).toBe(false)
	})

	it('maps 400 details to the fields', async () => {
		signedInAs(ADMIN_USER, {
			'GET /profile': { status: 200, data: ADMIN_PROFILE },
			'PATCH /profile': apiError(400, 'VALIDATION_ERROR', { details: [{ path: 'lastName', code: 'TOO_LONG', params: { max: 100 } }] }),
		})
		await renderProfile()

		fillNames('Peter', 'Novák')
		fireEvent.click(getSaveButton())

		expect(await screen.findByText('Zadajte najviac 100 znakov.')).toBeInTheDocument()
		expect(screen.getByLabelText('Priezvisko')).toHaveAttribute('aria-invalid', 'true')
	})

	it('shows other save errors as a notification', async () => {
		const show = vi.spyOn(notifications, 'show')
		signedInAs(ADMIN_USER, {
			'GET /profile': { status: 200, data: ADMIN_PROFILE },
			'PATCH /profile': apiError(500, 'INTERNAL_ERROR'),
		})
		await renderProfile()

		fillNames('Peter', 'Novák')
		fireEvent.click(getSaveButton())

		await waitFor(() =>
			expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'red', message: 'Nastala neočakávaná chyba. Skúste to znova.' })),
		)
		expect(screen.getByLabelText('Meno')).toHaveValue('Peter')
	})

	it('saves the trimmed names, notifies and updates the card and the sidebar user block', async () => {
		const show = vi.spyOn(notifications, 'show')
		const requests = signedInAs(ADMIN_USER, {
			'GET /profile': { status: 200, data: ADMIN_PROFILE },
			'PATCH /profile': { status: 200, data: { ...ADMIN_PROFILE, firstName: 'Peter', lastName: 'Novák' } },
		})
		await renderProfile()
		expect(getSidebar().getByText('MK')).toBeInTheDocument()
		expect(getSidebar().getByText('Martin Kováč')).toBeInTheDocument()

		fillNames('  Peter ', 'Novák  ')
		fireEvent.click(getSaveButton())

		expect(await screen.findByRole('heading', { level: 2, name: 'Peter Novák' })).toBeInTheDocument()
		expect(getSidebar().getByText('PN')).toBeInTheDocument()
		expect(getSidebar().getByText('Peter Novák')).toBeInTheDocument()
		expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'green', message: 'Profil bol uložený.' }))
		const patches = requests.filter((request) => request.method === 'patch' && request.url === '/profile')
		expect(patches).toHaveLength(1)
		expect(JSON.parse(patches[0]?.data as string)).toEqual({ firstName: 'Peter', lastName: 'Novák' })
		expect(screen.getByLabelText('Meno')).toHaveValue('Peter')
		await waitFor(() => expect(getSaveButton()).toBeDisabled())
		expect(requests.filter((request) => request.url === '/auth/me')).toHaveLength(1)
	})

	it('sends one request when the form is submitted twice while pending', async () => {
		signedInAs(ADMIN_USER, { 'GET /profile': { status: 200, data: ADMIN_PROFILE } })
		const adapter = http.defaults.adapter as AxiosAdapter
		const patches: unknown[] = []
		http.defaults.adapter = (config) => {
			if (config.method === 'patch') {
				patches.push(config)
				return new Promise(() => undefined)
			}
			return adapter(config)
		}
		await renderProfile()

		fillNames('Peter', 'Novák')
		fireEvent.click(getSaveButton())
		await waitFor(() => expect(getSaveButton()).toHaveAttribute('data-loading', 'true'))
		const form = getSaveButton().closest('form')
		expect(form).not.toBeNull()
		fireEvent.submit(form as HTMLFormElement)

		await new Promise((resolve) => setTimeout(resolve, 50))
		expect(patches).toHaveLength(1)
	})

	it('shows skeleton cards while loading', async () => {
		signedInAs(ADMIN_USER)
		const adapter = http.defaults.adapter as AxiosAdapter
		http.defaults.adapter = (config) => (config.url === '/profile' ? new Promise(() => undefined) : adapter(config))
		renderApp('/profile')

		await screen.findByRole('heading', { level: 1, name: 'Môj profil' })
		expect(document.querySelector('[aria-busy="true"]')).not.toBeNull()
		expect(screen.queryByLabelText('Meno')).not.toBeInTheDocument()
	})

	it('shows the translated load error and retries', async () => {
		let backendUp = false
		signedInAs(ADMIN_USER, {
			'GET /profile': () => (backendUp ? { status: 200, data: ADMIN_PROFILE } : apiError(500, 'INTERNAL_ERROR')),
		})
		renderApp('/profile')

		expect(await screen.findByText('Profil sa nepodarilo načítať.')).toBeInTheDocument()
		expect(screen.getByText('Nastala neočakávaná chyba. Skúste to znova.')).toBeInTheDocument()
		expect(screen.queryByText('English message that must not be shown')).not.toBeInTheDocument()

		backendUp = true
		fireEvent.click(screen.getByRole('button', { name: 'Skúsiť znova' }))

		expect(await screen.findByLabelText('Meno')).toHaveValue('Martin')
	})

	it('switches the UI language from the language select without saving', async () => {
		const requests = signedInAs(ADMIN_USER, { 'GET /profile': { status: 200, data: ADMIN_PROFILE } })
		await renderProfile()

		expect(screen.getByLabelText('Jazyk rozhrania')).toHaveValue('Slovenčina')
		fireEvent.click(screen.getByLabelText('Jazyk rozhrania'))
		fireEvent.click(await screen.findByRole('option', { name: 'English' }))

		expect(await screen.findByRole('heading', { level: 1, name: 'My profile' })).toBeInTheDocument()
		expect(screen.getByLabelText('Interface language')).toHaveValue('English')
		expect(screen.getByText('Password was last changed 3 months ago.')).toBeInTheDocument()
		expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en')
		expect(requests.some((request) => request.method === 'patch')).toBe(false)
	})

	it('shows the relative password time in en', async () => {
		await i18n.changeLanguage('en')
		signedInAs(ADMIN_USER, { 'GET /profile': { status: 200, data: ADMIN_PROFILE } })
		renderApp('/profile')

		expect(await screen.findByText('Password was last changed 3 months ago.')).toBeInTheDocument()
		expect(getMain().getByText('Administrator')).toBeInTheDocument()
	})

	it('opens from the user menu', async () => {
		signedInAs(EDITOR_USER, { 'GET /profile': { status: 200, data: profileOf(EDITOR_USER) } })
		const router = renderApp('/')

		fireEvent.click(await screen.findByRole('button', { name: 'Menu používateľa' }))
		fireEvent.click(await screen.findByRole('menuitem', { name: 'Môj profil' }))

		await waitFor(() => expect(router.state.location.pathname).toBe('/profile'))
		expect(await screen.findByRole('heading', { level: 1, name: 'Môj profil' })).toBeInTheDocument()
	})
})
