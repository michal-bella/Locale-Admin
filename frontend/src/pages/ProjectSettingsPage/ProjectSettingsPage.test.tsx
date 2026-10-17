import { notifications } from '@mantine/notifications'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vite-plus/test'

import { type Language, type ProjectSettings, SUPPORTED_LANGUAGES } from '@locale/shared'

import http from '@/api/http'
import queryClient from '@/api/queryClient'
import { QUERY_KEYS } from '@/api/queryKeys'
import i18n from '@/lib/i18n'
import { ADMIN_USER, apiError, EDITOR_USER, signedInAs } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'

const toLanguage = (tag: Language['tag'], index: number, isBase = false): Language => {
	const supported = SUPPORTED_LANGUAGES.find((language) => language.tag === tag)
	if (!supported) {
		throw new Error(`Unknown tag ${tag}`)
	}
	return {
		id: `00000000-0000-4000-8000-0000000001${String(index).padStart(2, '0')}`,
		...supported,
		isBase,
		createdAt: '2026-10-17T10:00:00.000Z',
	}
}

const SLOVAK = toLanguage('sk', 1, true)
const ENGLISH = toLanguage('en', 2)

const SETTINGS: ProjectSettings = {
	id: '00000000-0000-4000-8000-000000000301',
	name: 'B2B Admin',
	slug: 'b2b-admin',
	primaryColor: '#E83E8C',
	protectVariables: true,
	baseLanguageId: SLOVAK.id,
}

const loaded = (settings: ProjectSettings = SETTINGS, languages: Language[] = [SLOVAK, ENGLISH]) => ({
	'GET /admin/project': { status: 200, data: settings },
	'GET /admin/languages': { status: 200, data: languages },
})

const getSaveButton = () => screen.getByRole('button', { name: 'Uložiť zmeny' })

const getPreview = () => screen.getByText('Ukážka')

const renderSettings = async () => {
	renderApp('/project-settings')
	return screen.findByLabelText('Názov projektu')
}

const change = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

const patchesOf = (requests: InternalAxiosRequestConfig[]) => requests.filter((request) => request.method === 'patch' && request.url === '/admin/project')

const bodyOf = (request: InternalAxiosRequestConfig | undefined) => JSON.parse(request?.data as string) as unknown

beforeAll(() => {
	// The global 3 retries with backoff would delay the error state by seconds.
	queryClient.setQueryDefaults(QUERY_KEYS.PROJECT_SETTINGS(), { retry: false })
	queryClient.setQueryDefaults(QUERY_KEYS.LANGUAGES(), { retry: false })
})

afterEach(() => {
	vi.restoreAllMocks()
})

describe('ProjectSettingsPage', () => {
	it('prefills every field from the saved settings', async () => {
		signedInAs(ADMIN_USER, loaded())
		await renderSettings()

		expect(screen.getByRole('heading', { level: 1, name: 'Nastavenia projektu' })).toBeInTheDocument()
		expect(screen.getByLabelText('Názov projektu')).toHaveValue('B2B Admin')
		expect(screen.getByLabelText('Slug projektu')).toHaveValue('b2b-admin')
		expect(screen.getByLabelText('Slug projektu')).toHaveAccessibleDescription('Používa sa pri pomenovaní exportovaných súborov.')
		expect(screen.getByLabelText('Primárna farba')).toHaveValue('#E83E8C')
		expect(screen.getByLabelText('Základný jazyk')).toHaveValue('Slovak (sk)')
		// Mantine renders the description inside the <label>; the braces come through a parameter, not i18next interpolation.
		const protect = screen.getByRole('switch', { name: /^Chrániť výrazy \{\{ variable \}\}/ })
		expect(protect).toBeChecked()
		expect(document.title).toBe('Nastavenia projektu – Locale')
	})

	it('shows skeleton cards while loading', async () => {
		signedInAs(ADMIN_USER, loaded())
		const adapter = http.defaults.adapter as AxiosAdapter
		http.defaults.adapter = (config) => (config.url === '/admin/project' ? new Promise(() => undefined) : adapter(config))
		renderApp('/project-settings')

		await screen.findByRole('heading', { level: 1, name: 'Nastavenia projektu' })
		expect(document.querySelector('[aria-busy="true"]')).not.toBeNull()
		expect(screen.queryByLabelText('Názov projektu')).not.toBeInTheDocument()
	})

	it('shows the translated load error and retries', async () => {
		let backendUp = false
		signedInAs(ADMIN_USER, {
			...loaded(),
			'GET /admin/project': () => (backendUp ? { status: 200, data: SETTINGS } : apiError(404, 'NOT_FOUND')),
		})
		renderApp('/project-settings')

		expect(await screen.findByText('Nastavenia projektu sa nepodarilo načítať.')).toBeInTheDocument()
		expect(screen.getByText('Požadovaný záznam sa nenašiel.')).toBeInTheDocument()
		expect(screen.queryByText('English message that must not be shown')).not.toBeInTheDocument()

		backendUp = true
		const retry = screen.getByRole('button', { name: 'Skúsiť znova' })
		retry.focus()
		fireEvent.click(retry)

		expect(await screen.findByLabelText('Názov projektu')).toHaveValue('B2B Admin')
		await waitFor(() => expect(screen.getByLabelText('Názov projektu')).toHaveFocus())
	})

	it('shows the load error when the languages fail', async () => {
		signedInAs(ADMIN_USER, { ...loaded(), 'GET /admin/languages': apiError(500, 'INTERNAL_ERROR') })
		renderApp('/project-settings')

		expect(await screen.findByText('Nastavenia projektu sa nepodarilo načítať.')).toBeInTheDocument()
		expect(screen.getByText('Nastala neočakávaná chyba. Skúste to znova.')).toBeInTheDocument()
	})

	it('enables Save only when a value changes', async () => {
		signedInAs(ADMIN_USER, loaded())
		await renderSettings()

		expect(getSaveButton()).toBeDisabled()
		change('Názov projektu', 'B2C iOS')
		expect(getSaveButton()).toBeEnabled()

		change('Názov projektu', 'B2B Admin')
		await waitFor(() => expect(getSaveButton()).toBeDisabled())

		fireEvent.click(screen.getByRole('switch', { name: /^Chrániť výrazy/ }))
		await waitFor(() => expect(getSaveButton()).toBeEnabled())
	})

	it('shows client validation errors at the fields without sending a request', async () => {
		const requests = signedInAs(ADMIN_USER, loaded())
		await renderSettings()

		change('Názov projektu', '   ')
		change('Slug projektu', 'B2B Admin')
		change('Primárna farba', '#FFF')
		fireEvent.click(getSaveButton())

		expect(await screen.findByText('Toto pole je povinné.')).toBeInTheDocument()
		expect(screen.getAllByText('Neplatná hodnota.')).toHaveLength(2)
		expect(screen.getByLabelText('Názov projektu')).toHaveAttribute('aria-invalid', 'true')
		expect(screen.getByLabelText('Slug projektu')).toHaveAttribute('aria-invalid', 'true')
		expect(screen.getByLabelText('Primárna farba')).toHaveAttribute('aria-invalid', 'true')
		expect(patchesOf(requests)).toHaveLength(0)
	})

	it('focuses Primárna farba when only the color is invalid', async () => {
		const requests = signedInAs(ADMIN_USER, loaded())
		await renderSettings()

		change('Primárna farba', 'red')
		fireEvent.click(getSaveButton())

		expect(await screen.findByText('Neplatná hodnota.')).toBeInTheDocument()
		await waitFor(() => expect(screen.getByLabelText('Primárna farba')).toHaveFocus())
		expect(patchesOf(requests)).toHaveLength(0)
	})

	it('maps a 400 for the base language to the select and focuses it', async () => {
		signedInAs(ADMIN_USER, {
			...loaded(),
			'PATCH /admin/project': apiError(400, 'VALIDATION_ERROR', { details: [{ path: 'baseLanguageId', code: 'INVALID' }] }),
		})
		await renderSettings()

		change('Názov projektu', 'B2C iOS')
		fireEvent.click(getSaveButton())

		expect(await screen.findByText('Neplatná hodnota.')).toBeInTheDocument()
		expect(screen.getByLabelText('Základný jazyk')).toHaveAttribute('aria-invalid', 'true')
		await waitFor(() => expect(screen.getByLabelText('Základný jazyk')).toHaveFocus())
	})

	it('saves the whole form, notifies and refetches the settings and the languages', async () => {
		const show = vi.spyOn(notifications, 'show')
		const saved: ProjectSettings = { ...SETTINGS, name: 'B2C iOS', slug: 'b2c-ios', primaryColor: '#1D4ED8', protectVariables: false }
		let current = SETTINGS
		const requests = signedInAs(ADMIN_USER, {
			...loaded(),
			'GET /admin/project': () => ({ status: 200, data: current }),
			'PATCH /admin/project': () => {
				current = saved
				return { status: 200, data: saved }
			},
		})
		await renderSettings()

		change('Názov projektu', '  B2C iOS ')
		change('Slug projektu', 'b2c-ios')
		change('Primárna farba', '#1d4ed8')
		fireEvent.click(screen.getByRole('switch', { name: /^Chrániť výrazy/ }))
		fireEvent.click(getSaveButton())

		await waitFor(() => expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'green', message: 'Nastavenia projektu boli uložené.' })))
		expect(patchesOf(requests)).toHaveLength(1)
		expect(bodyOf(patchesOf(requests)[0])).toEqual({
			name: 'B2C iOS',
			slug: 'b2c-ios',
			primaryColor: '#1D4ED8',
			protectVariables: false,
			baseLanguageId: SLOVAK.id,
		})
		expect(requests.filter((request) => request.method === 'get' && request.url === '/admin/languages')).toHaveLength(2)
		expect(requests.filter((request) => request.method === 'get' && request.url === '/admin/project')).toHaveLength(2)
		expect(screen.getByLabelText('Názov projektu')).toHaveValue('B2C iOS')
		expect(screen.getByLabelText('Primárna farba')).toHaveValue('#1D4ED8')
		await waitFor(() => expect(getSaveButton()).toBeDisabled())
	})

	it('changes the base language from the select', async () => {
		const requests = signedInAs(ADMIN_USER, {
			...loaded(),
			'PATCH /admin/project': { status: 200, data: { ...SETTINGS, baseLanguageId: ENGLISH.id } },
		})
		await renderSettings()

		fireEvent.click(screen.getByLabelText('Základný jazyk'))
		fireEvent.click(await screen.findByRole('option', { name: 'English (en)' }))
		expect(screen.getByLabelText('Základný jazyk')).toHaveValue('English (en)')
		fireEvent.click(getSaveButton())

		await waitFor(() => expect(patchesOf(requests)).toHaveLength(1))
		expect(bodyOf(patchesOf(requests)[0])).toMatchObject({ baseLanguageId: ENGLISH.id })
	})

	it('maps 400 details to the fields', async () => {
		signedInAs(ADMIN_USER, {
			...loaded(),
			'PATCH /admin/project': apiError(400, 'VALIDATION_ERROR', { details: [{ path: 'slug', code: 'TOO_LONG', params: { max: 50 } }] }),
		})
		await renderSettings()

		change('Slug projektu', 'b2b-admin-2')
		fireEvent.click(getSaveButton())

		expect(await screen.findByText('Zadajte najviac 50 znakov.')).toBeInTheDocument()
		expect(screen.getByLabelText('Slug projektu')).toHaveAttribute('aria-invalid', 'true')
		expect(screen.getByLabelText('Slug projektu')).toHaveFocus()
	})

	it('shows other save errors as a notification and keeps the typed values', async () => {
		const show = vi.spyOn(notifications, 'show')
		signedInAs(ADMIN_USER, { ...loaded(), 'PATCH /admin/project': apiError(404, 'NOT_FOUND') })
		await renderSettings()

		change('Názov projektu', 'B2C iOS')
		fireEvent.click(getSaveButton())

		await waitFor(() => expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'red', message: 'Požadovaný záznam sa nenašiel.' })))
		expect(screen.getByLabelText('Názov projektu')).toHaveValue('B2C iOS')
	})

	it('sends one request when the form is submitted twice while pending', async () => {
		signedInAs(ADMIN_USER, loaded())
		const adapter = http.defaults.adapter as AxiosAdapter
		const patches: unknown[] = []
		http.defaults.adapter = (config) => {
			if (config.method === 'patch') {
				patches.push(config)
				return new Promise(() => undefined)
			}
			return adapter(config)
		}
		await renderSettings()

		change('Názov projektu', 'B2C iOS')
		fireEvent.click(getSaveButton())
		await waitFor(() => expect(getSaveButton()).toHaveAttribute('data-loading', 'true'))
		const form = getSaveButton().closest('form')
		expect(form).not.toBeNull()
		fireEvent.submit(form as HTMLFormElement)

		await new Promise((resolve) => setTimeout(resolve, 50))
		expect(patches).toHaveLength(1)
	})

	it('disables the base language select and links to Jazyky when there are no languages', async () => {
		signedInAs(ADMIN_USER, loaded({ ...SETTINGS, baseLanguageId: null }, []))
		const router = renderApp('/project-settings')
		await screen.findByLabelText('Názov projektu')

		const select = screen.getByLabelText('Základný jazyk')
		expect(select).toBeDisabled()
		expect(select).toHaveValue('')
		expect(select).toHaveAccessibleDescription('Zatiaľ nemáte žiadne jazyky. Pridať jazyk')

		fireEvent.click(screen.getByRole('link', { name: 'Pridať jazyk' }))
		await waitFor(() => expect(router.state.location.pathname).toBe('/languages'))
	})

	it('shows Opustiť projekt as disabled with a tooltip', async () => {
		const requests = signedInAs(ADMIN_USER, loaded())
		await renderSettings()
		const leave = screen.getByRole('button', { name: 'Opustiť projekt' })

		expect(leave).toHaveAttribute('aria-disabled', 'true')
		expect(leave).toHaveAttribute('data-disabled')
		fireEvent.click(leave)
		expect(requests.some((request) => request.method !== 'get')).toBe(false)

		fireEvent.mouseEnter(leave)
		expect(await screen.findByText('Bude dostupné spolu so správou členov')).toBeInTheDocument()
		fireEvent.mouseLeave(leave)
		await waitFor(() => expect(screen.queryByText('Bude dostupné spolu so správou členov')).not.toBeInTheDocument())

		fireEvent.focus(leave)
		expect(await screen.findByText('Bude dostupné spolu so správou členov')).toBeInTheDocument()
	})

	it('paints the Ukážka chip in the typed color with readable text', async () => {
		signedInAs(ADMIN_USER, loaded())
		await renderSettings()

		expect(getPreview()).toHaveStyle({ backgroundColor: '#E83E8C' })
		expect(getPreview()).toHaveAttribute('data-tone', 'light')

		change('Primárna farba', '#facc15')
		expect(getPreview()).toHaveStyle({ backgroundColor: '#FACC15' })
		expect(getPreview()).toHaveAttribute('data-tone', 'dark')

		// An unfinished color keeps the last saved one.
		change('Primárna farba', '#fac')
		expect(getPreview()).toHaveStyle({ backgroundColor: '#E83E8C' })
	})

	it('renders in en with the braces kept', async () => {
		await i18n.changeLanguage('en')
		signedInAs(ADMIN_USER, loaded())
		renderApp('/project-settings')

		expect(await screen.findByLabelText('Project name')).toHaveValue('B2B Admin')
		expect(screen.getByRole('switch', { name: /^Protect \{\{ variable \}\} expressions/ })).toBeChecked()
		expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
	})

	it('shows the 403 page to an EDITOR without loading the settings', async () => {
		const requests = signedInAs(EDITOR_USER, loaded())
		renderApp('/project-settings')

		expect(await screen.findByRole('heading', { level: 1, name: 'Prístup zamietnutý' })).toBeInTheDocument()
		expect(requests.some((request) => request.url === '/admin/project')).toBe(false)
	})
})
