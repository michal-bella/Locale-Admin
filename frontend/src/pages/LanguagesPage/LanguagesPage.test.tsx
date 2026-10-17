import { notifications } from '@mantine/notifications'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vite-plus/test'

import { type Language, SUPPORTED_LANGUAGES } from '@locale/shared'

import http from '@/api/http'
import queryClient from '@/api/queryClient'
import { QUERY_KEYS } from '@/api/queryKeys'
import i18n from '@/lib/i18n'
import { ADMIN_USER, apiError, signedInAs } from '@/test/mockApi'
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
const RUSSIAN = toLanguage('ru', 3)
const ALL_LANGUAGES = SUPPORTED_LANGUAGES.map((language, index) => toLanguage(language.tag, 10 + index, language.tag === 'sk'))

const languagesResponse = (languages: Language[]) => ({ status: 200, data: languages })

const getTable = (label = 'Zoznam jazykov') => screen.getByRole('table', { name: label })

const getRow = (name: string, tableLabel?: string) => {
	const row = within(getTable(tableLabel)).getByText(name).closest('tr')
	if (!row) {
		throw new Error(`Row ${name} not found`)
	}
	return row
}

const bodyOf = (request: InternalAxiosRequestConfig | undefined) => JSON.parse(request?.data as string) as unknown

const openRowMenu = async (name: string) => {
	fireEvent.click(await screen.findByRole('button', { name: `Akcie pre jazyk ${name}` }))
}

const openAddModal = async () => {
	fireEvent.click(await screen.findByRole('button', { name: 'Pridať jazyk' }))
	return screen.findByRole('dialog', { name: 'Pridať jazyk' })
}

const openSettings = async (name: string) => {
	await openRowMenu(name)
	fireEvent.click(await screen.findByRole('menuitem', { name: 'Upraviť' }))
	return screen.findByRole('dialog', { name: 'Nastavenia jazyka' })
}

const pickOption = async (input: HTMLElement, name: string) => {
	fireEvent.click(input)
	fireEvent.click(await screen.findByRole('option', { name }))
}

/** GET returns the current list, DELETE removes the language from it. */
const mockLanguagesApi = (initial: Language[]) => {
	let languages = initial
	const requests = signedInAs(ADMIN_USER, {
		'GET /admin/languages': () => languagesResponse(languages),
		...Object.fromEntries(
			initial.map((language) => [
				`DELETE /admin/languages/${language.id}`,
				() => {
					languages = languages.filter((item) => item.id !== language.id)
					return { status: 204 }
				},
			]),
		),
	})
	return requests
}

beforeAll(() => {
	// The global 3 retries with backoff would delay the error state by seconds.
	queryClient.setQueryDefaults(QUERY_KEYS.LANGUAGES(), { retry: false })
})

afterEach(() => {
	vi.restoreAllMocks()
})

describe('LanguagesPage table', () => {
	it('renders the header and rows with flags, names, tags and the base badge', async () => {
		signedInAs(ADMIN_USER, { 'GET /admin/languages': languagesResponse([SLOVAK, ENGLISH]) })
		renderApp('/languages')

		expect(await screen.findByText('Slovak')).toBeInTheDocument()
		expect(screen.getByText('Lokalizácia')).toBeInTheDocument()
		expect(screen.getByRole('heading', { level: 1, name: 'Jazyky' })).toBeInTheDocument()
		expect(screen.getByText('Nastavte zdrojový jazyk a spravujte cieľové jazyky projektu.')).toBeInTheDocument()
		expect(within(getTable()).getByRole('columnheader', { name: 'Jazyk' })).toBeInTheDocument()
		expect(within(getTable()).getByRole('columnheader', { name: 'Akcie' })).toBeInTheDocument()
		expect(within(getTable()).getAllByRole('row').slice(1)).toHaveLength(2)

		const slovakRow = getRow('Slovak')
		expect(within(slovakRow).getByText('slovenčina · sk')).toBeInTheDocument()
		expect(within(slovakRow).getByText('Základný')).toBeInTheDocument()
		expect(slovakRow.querySelector('[data-flag="sk"]')).not.toBeNull()

		const englishRow = getRow('English')
		expect(within(englishRow).getByText('English · en')).toBeInTheDocument()
		expect(within(englishRow).queryByText('Základný')).not.toBeInTheDocument()
		expect(englishRow.querySelector('[data-flag="gb"]')).not.toBeNull()
	})

	it('shows skeleton rows while loading and keeps Pridať jazyk disabled', async () => {
		signedInAs(ADMIN_USER)
		const adapter = http.defaults.adapter as AxiosAdapter
		http.defaults.adapter = (config) => (config.url === '/admin/languages' ? new Promise(() => undefined) : adapter(config))
		renderApp('/languages')

		await screen.findByRole('heading', { level: 1, name: 'Jazyky' })
		expect(getTable()).toHaveAttribute('aria-busy', 'true')
		expect(within(getTable()).getAllByRole('row').slice(1)).toHaveLength(3)
		expect(screen.getByRole('button', { name: 'Pridať jazyk' })).toBeDisabled()
	})

	it('shows the empty state with a button that opens the add modal', async () => {
		signedInAs(ADMIN_USER, { 'GET /admin/languages': languagesResponse([]) })
		renderApp('/languages')

		expect(await screen.findByText('Zatiaľ nemáte žiadne jazyky.')).toBeInTheDocument()
		expect(getTable()).toHaveAttribute('aria-busy', 'false')
		fireEvent.click(within(getTable()).getByRole('button', { name: 'Pridať jazyk' }))

		expect(await screen.findByRole('dialog', { name: 'Pridať jazyk' })).toBeInTheDocument()
	})

	it('shows the translated load error and retries', async () => {
		let backendUp = false
		signedInAs(ADMIN_USER, {
			'GET /admin/languages': () => (backendUp ? languagesResponse([SLOVAK]) : apiError(500, 'INTERNAL_ERROR')),
		})
		renderApp('/languages')

		expect(await screen.findByText('Zoznam jazykov sa nepodarilo načítať.')).toBeInTheDocument()
		expect(screen.getByText('Nastala neočakávaná chyba. Skúste to znova.')).toBeInTheDocument()
		expect(screen.queryByText('English message that must not be shown')).not.toBeInTheDocument()

		backendUp = true
		fireEvent.click(screen.getByRole('button', { name: 'Skúsiť znova' }))

		expect(await screen.findByText('Slovak')).toBeInTheDocument()
	})

	it('renders texts in en', async () => {
		await i18n.changeLanguage('en')
		signedInAs(ADMIN_USER, { 'GET /admin/languages': languagesResponse([SLOVAK]) })
		renderApp('/languages')

		expect(await screen.findByText('Slovak')).toBeInTheDocument()
		expect(screen.getByRole('heading', { level: 1, name: 'Languages' })).toBeInTheDocument()
		expect(within(getRow('Slovak', 'Language list')).getByText('Base')).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Add language' })).toBeEnabled()
	})
})

describe('AddLanguageModal', () => {
	it('disables already added languages and adds the selected one', async () => {
		const show = vi.spyOn(notifications, 'show')
		let languages = [SLOVAK, ENGLISH]
		const requests = signedInAs(ADMIN_USER, {
			'GET /admin/languages': () => languagesResponse(languages),
			'POST /admin/languages': () => {
				languages = [...languages, RUSSIAN]
				return { status: 201, data: RUSSIAN }
			},
		})
		renderApp('/languages')
		await screen.findByText('Slovak')
		const dialog = await openAddModal()

		const submit = within(dialog).getByRole('button', { name: 'Pridať' })
		expect(submit).toBeDisabled()
		const input = within(dialog).getByLabelText('Jazyk', { selector: 'input' })
		fireEvent.click(input)
		expect(await screen.findByRole('option', { name: 'Slovak – slovenčina – sk' })).toHaveAttribute('data-combobox-disabled', 'true')
		expect(screen.getByRole('option', { name: 'English – English – en' })).toHaveAttribute('data-combobox-disabled', 'true')
		expect(screen.getByRole('option', { name: 'Russian – русский – ru' })).not.toHaveAttribute('data-combobox-disabled')
		expect(screen.getAllByRole('option')).toHaveLength(SUPPORTED_LANGUAGES.length)

		fireEvent.change(input, { target: { value: 'русск' } })
		expect(screen.getAllByRole('option')).toHaveLength(1)
		fireEvent.click(screen.getByRole('option', { name: 'Russian – русский – ru' }))
		fireEvent.click(submit)

		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
		expect(await screen.findByText('Russian')).toBeInTheDocument()
		const posts = requests.filter((request) => request.method === 'post' && request.url === '/admin/languages')
		expect(posts).toHaveLength(1)
		expect(bodyOf(posts[0])).toEqual({ tag: 'ru' })
		expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'green', message: 'Jazyk Russian bol pridaný.' }))
	})

	it('searches by tag', async () => {
		signedInAs(ADMIN_USER, { 'GET /admin/languages': languagesResponse([SLOVAK]) })
		renderApp('/languages')
		await screen.findByText('Slovak')
		const dialog = await openAddModal()

		const input = within(dialog).getByLabelText('Jazyk', { selector: 'input' })
		fireEvent.click(input)
		fireEvent.change(input, { target: { value: 'de-AT' } })

		expect(await screen.findByRole('option', { name: 'German (Austria) – Deutsch (Österreich) – de-AT' })).toBeInTheDocument()
		expect(screen.getAllByRole('option')).toHaveLength(1)
	})

	it('disables Pridať jazyk when every supported language is added', async () => {
		signedInAs(ADMIN_USER, { 'GET /admin/languages': languagesResponse(ALL_LANGUAGES) })
		renderApp('/languages')

		await screen.findByText('Slovak')
		expect(screen.getByRole('button', { name: 'Pridať jazyk' })).toBeDisabled()
	})

	it('shows 409 LANGUAGE_TAKEN at the field, clears the selection and refetches the list', async () => {
		const show = vi.spyOn(notifications, 'show')
		let languages = [SLOVAK]
		const requests = signedInAs(ADMIN_USER, {
			'GET /admin/languages': () => languagesResponse(languages),
			'POST /admin/languages': () => {
				languages = [SLOVAK, RUSSIAN]
				return apiError(409, 'LANGUAGE_TAKEN')
			},
		})
		renderApp('/languages')
		await screen.findByText('Slovak')
		const dialog = await openAddModal()

		const input = within(dialog).getByLabelText('Jazyk', { selector: 'input' })
		const submit = within(dialog).getByRole('button', { name: 'Pridať' })
		await pickOption(input, 'Russian – русский – ru')
		fireEvent.click(submit)

		expect(await within(dialog).findByText('Tento jazyk je už pridaný.')).toBeInTheDocument()
		expect(input).toHaveAttribute('aria-invalid', 'true')
		expect(input).toHaveValue('')
		expect(submit).toBeDisabled()
		expect(show).not.toHaveBeenCalledWith(expect.objectContaining({ color: 'red' }))
		expect(screen.getByRole('dialog', { name: 'Pridať jazyk' })).toBeInTheDocument()
		await waitFor(() => expect(requests.filter((request) => request.method === 'get' && request.url === '/admin/languages')).toHaveLength(2))

		fireEvent.click(input)
		await waitFor(() => expect(screen.getByRole('option', { name: 'Russian – русский – ru' })).toHaveAttribute('data-combobox-disabled', 'true'))
		fireEvent.click(screen.getByRole('option', { name: 'English – English – en' }))
		expect(within(dialog).queryByText('Tento jazyk je už pridaný.')).not.toBeInTheDocument()
		expect(input).not.toHaveAttribute('aria-invalid')
		expect(submit).toBeEnabled()
	})
})

describe('LanguageSettingsModal', () => {
	it('is prefilled, keeps the tag read-only and Uložiť disabled until a change', async () => {
		signedInAs(ADMIN_USER, { 'GET /admin/languages': languagesResponse([SLOVAK, ENGLISH]) })
		renderApp('/languages')
		const dialog = await openSettings('English')

		expect(within(dialog).getByLabelText('Anglický názov')).toHaveValue('English')
		expect(within(dialog).getByLabelText('Pôvodný názov')).toHaveValue('English')
		expect(within(dialog).getByLabelText('Vlajka', { selector: 'input' })).toHaveValue('Spojené kráľovstvo (GB)')
		expect(within(dialog).getByLabelText('Tag')).toHaveValue('en')
		expect(within(dialog).getByLabelText('Tag')).toBeDisabled()
		const tagDescription = within(dialog).getByText('Tag sa nedá zmeniť.')
		expect(within(dialog).getByLabelText('Tag')).toHaveAccessibleDescription('Tag sa nedá zmeniť.')
		expect(within(dialog).getByLabelText('Tag').compareDocumentPosition(tagDescription) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
		expect(within(dialog).getByRole('switch', { name: /Základný jazyk/ })).not.toBeChecked()
		const save = within(dialog).getByRole('button', { name: 'Uložiť' })
		expect(save).toBeDisabled()

		fireEvent.change(within(dialog).getByLabelText('Anglický názov'), { target: { value: 'English (UK)' } })
		await waitFor(() => expect(save).toBeEnabled())
		fireEvent.change(within(dialog).getByLabelText('Anglický názov'), { target: { value: 'English' } })
		await waitFor(() => expect(save).toBeDisabled())
	})

	it('shows client validation errors without sending a request', async () => {
		const requests = signedInAs(ADMIN_USER, { 'GET /admin/languages': languagesResponse([SLOVAK, ENGLISH]) })
		renderApp('/languages')
		const dialog = await openSettings('English')

		fireEvent.change(within(dialog).getByLabelText('Anglický názov'), { target: { value: '   ' } })
		fireEvent.change(within(dialog).getByLabelText('Pôvodný názov'), { target: { value: 'x'.repeat(101) } })
		fireEvent.click(within(dialog).getByRole('button', { name: 'Uložiť' }))

		expect(await within(dialog).findByText('Toto pole je povinné.')).toBeInTheDocument()
		expect(within(dialog).getByText('Zadajte najviac 100 znakov.')).toBeInTheDocument()
		expect(requests.some((request) => request.method === 'patch')).toBe(false)
	})

	it('maps 400 details to the fields', async () => {
		signedInAs(ADMIN_USER, {
			'GET /admin/languages': languagesResponse([SLOVAK, ENGLISH]),
			[`PATCH /admin/languages/${ENGLISH.id}`]: apiError(400, 'VALIDATION_ERROR', {
				details: [{ path: 'nativeName', code: 'TOO_LONG', params: { max: 100 } }],
			}),
		})
		renderApp('/languages')
		const dialog = await openSettings('English')

		fireEvent.change(within(dialog).getByLabelText('Pôvodný názov'), { target: { value: 'Anglicky' } })
		fireEvent.click(within(dialog).getByRole('button', { name: 'Uložiť' }))

		expect(await within(dialog).findByText('Zadajte najviac 100 znakov.')).toBeInTheDocument()
		expect(within(dialog).getByLabelText('Pôvodný názov')).toHaveAttribute('aria-invalid', 'true')
	})

	it('saves trimmed names and the flag, closes and notifies', async () => {
		const show = vi.spyOn(notifications, 'show')
		const saved: Language = { ...ENGLISH, englishName: 'English (US)', flagCode: 'gb' }
		const requests = signedInAs(ADMIN_USER, {
			'GET /admin/languages': languagesResponse([SLOVAK, ENGLISH]),
			[`PATCH /admin/languages/${ENGLISH.id}`]: { status: 200, data: saved },
		})
		renderApp('/languages')
		const dialog = await openSettings('English')

		fireEvent.change(within(dialog).getByLabelText('Anglický názov'), { target: { value: '  English (US) ' } })
		await pickOption(within(dialog).getByLabelText('Vlajka', { selector: 'input' }), 'Slovensko (SK)')
		expect(within(dialog).getByLabelText('Vlajka', { selector: 'input' })).toHaveValue('Slovensko (SK)')
		fireEvent.click(within(dialog).getByRole('button', { name: 'Uložiť' }))

		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
		const patches = requests.filter((request) => request.method === 'patch')
		expect(patches).toHaveLength(1)
		expect(bodyOf(patches[0])).toEqual({ englishName: 'English (US)', nativeName: 'English', flagCode: 'sk' })
		expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'green', message: 'Jazyk English (US) bol uložený.' }))
	})

	it('sets another language as the base language', async () => {
		let languages = [SLOVAK, ENGLISH]
		const requests = signedInAs(ADMIN_USER, {
			'GET /admin/languages': () => languagesResponse(languages),
			[`PATCH /admin/languages/${ENGLISH.id}`]: () => {
				languages = [
					{ ...ENGLISH, isBase: true },
					{ ...SLOVAK, isBase: false },
				]
				return { status: 200, data: { ...ENGLISH, isBase: true } }
			},
		})
		renderApp('/languages')
		const dialog = await openSettings('English')

		fireEvent.click(within(dialog).getByRole('switch', { name: /Základný jazyk/ }))
		fireEvent.click(within(dialog).getByRole('button', { name: 'Uložiť' }))

		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
		expect(bodyOf(requests.find((request) => request.method === 'patch'))).toEqual({
			englishName: 'English',
			nativeName: 'English',
			flagCode: 'gb',
			isBase: true,
		})
		await waitFor(() => expect(within(getRow('English')).getByText('Základný')).toBeInTheDocument())
		expect(within(getRow('Slovak')).queryByText('Základný')).not.toBeInTheDocument()
	})

	it('keeps the base switch on and disabled and disables delete for the base language', async () => {
		signedInAs(ADMIN_USER, { 'GET /admin/languages': languagesResponse([SLOVAK, ENGLISH]) })
		renderApp('/languages')
		const dialog = await openSettings('Slovak')

		const baseSwitch = within(dialog).getByRole('switch', { name: /Základný jazyk/ })
		expect(baseSwitch).toBeChecked()
		expect(baseSwitch).toBeDisabled()
		expect(within(dialog).getByRole('button', { name: 'Odstrániť jazyk' })).toBeDisabled()
	})

	it('shows 404 as a notification, closes the modal and refetches the list', async () => {
		const show = vi.spyOn(notifications, 'show')
		const requests = signedInAs(ADMIN_USER, {
			'GET /admin/languages': languagesResponse([SLOVAK, ENGLISH]),
			[`PATCH /admin/languages/${ENGLISH.id}`]: apiError(404, 'NOT_FOUND'),
		})
		renderApp('/languages')
		const dialog = await openSettings('English')

		fireEvent.change(within(dialog).getByLabelText('Anglický názov'), { target: { value: 'English (UK)' } })
		fireEvent.click(within(dialog).getByRole('button', { name: 'Uložiť' }))

		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
		expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'red', message: 'Požadovaný záznam sa nenašiel.' }))
		await waitFor(() => expect(requests.filter((request) => request.method === 'get' && request.url === '/admin/languages')).toHaveLength(2))
	})
})

describe('Deleting a language', () => {
	it('disables Odstrániť in the row menu of the base language', async () => {
		signedInAs(ADMIN_USER, { 'GET /admin/languages': languagesResponse([SLOVAK, ENGLISH]) })
		renderApp('/languages')

		await openRowMenu('Slovak')

		expect(await screen.findByRole('menuitem', { name: 'Odstrániť' })).toBeDisabled()
	})

	it('asks for confirmation from the row menu; Zrušiť deletes nothing, Odstrániť deletes', async () => {
		const show = vi.spyOn(notifications, 'show')
		const requests = mockLanguagesApi([SLOVAK, ENGLISH])
		renderApp('/languages')

		await openRowMenu('English')
		fireEvent.click(await screen.findByRole('menuitem', { name: 'Odstrániť' }))
		let confirm = await screen.findByRole('dialog', { name: 'Odstrániť jazyk' })
		expect(within(confirm).getByText('Naozaj chcete odstrániť jazyk English (en)?')).toBeInTheDocument()
		fireEvent.click(within(confirm).getByRole('button', { name: 'Zrušiť' }))
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
		expect(requests.some((request) => request.method === 'delete')).toBe(false)
		expect(getRow('English')).toBeInTheDocument()

		await openRowMenu('English')
		fireEvent.click(await screen.findByRole('menuitem', { name: 'Odstrániť' }))
		confirm = await screen.findByRole('dialog', { name: 'Odstrániť jazyk' })
		fireEvent.click(within(confirm).getByRole('button', { name: 'Odstrániť' }))

		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
		await waitFor(() => expect(within(getTable()).queryByText('English')).not.toBeInTheDocument())
		expect(requests.filter((request) => request.method === 'delete').map((request) => request.url)).toEqual([`/admin/languages/${ENGLISH.id}`])
		expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'green', message: 'Jazyk English bol odstránený.' }))
	})

	it('asks for confirmation from the settings modal and closes both modals after deleting', async () => {
		const requests = mockLanguagesApi([SLOVAK, ENGLISH])
		renderApp('/languages')
		const settings = await openSettings('English')

		fireEvent.click(within(settings).getByRole('button', { name: 'Odstrániť jazyk' }))
		let confirm = await screen.findByRole('dialog', { name: 'Odstrániť jazyk' })
		fireEvent.click(within(confirm).getByRole('button', { name: 'Zrušiť' }))
		await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Odstrániť jazyk' })).not.toBeInTheDocument())
		expect(screen.getByRole('dialog', { name: 'Nastavenia jazyka' })).toBeInTheDocument()
		expect(requests.some((request) => request.method === 'delete')).toBe(false)

		fireEvent.click(within(settings).getByRole('button', { name: 'Odstrániť jazyk' }))
		confirm = await screen.findByRole('dialog', { name: 'Odstrániť jazyk' })
		fireEvent.click(within(confirm).getByRole('button', { name: 'Odstrániť' }))

		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
		expect(requests.filter((request) => request.method === 'delete')).toHaveLength(1)
		await waitFor(() => expect(within(getTable()).queryByText('English')).not.toBeInTheDocument())
	})

	it('shows 409 LANGUAGE_IS_BASE as a notification and refetches the list', async () => {
		const show = vi.spyOn(notifications, 'show')
		let languages = [SLOVAK, ENGLISH]
		const requests = signedInAs(ADMIN_USER, {
			'GET /admin/languages': () => languagesResponse(languages),
			[`DELETE /admin/languages/${ENGLISH.id}`]: () => {
				// Another admin made English the base language in the meantime.
				languages = [
					{ ...ENGLISH, isBase: true },
					{ ...SLOVAK, isBase: false },
				]
				return apiError(409, 'LANGUAGE_IS_BASE')
			},
		})
		renderApp('/languages')

		await openRowMenu('English')
		fireEvent.click(await screen.findByRole('menuitem', { name: 'Odstrániť' }))
		const confirm = await screen.findByRole('dialog', { name: 'Odstrániť jazyk' })
		fireEvent.click(within(confirm).getByRole('button', { name: 'Odstrániť' }))

		await waitFor(() =>
			expect(show).toHaveBeenCalledWith(
				expect.objectContaining({ color: 'red', message: 'Základný jazyk nie je možné odstrániť. Najprv nastavte iný základný jazyk.' }),
			),
		)
		expect(screen.getByRole('dialog', { name: 'Odstrániť jazyk' })).toBeInTheDocument()
		await waitFor(() => expect(requests.filter((request) => request.method === 'get' && request.url === '/admin/languages')).toHaveLength(2))
		await waitFor(() => expect(within(getRow('English')).getByText('Základný')).toBeInTheDocument())
		expect(within(getRow('Slovak')).queryByText('Základný')).not.toBeInTheDocument()
	})
})
