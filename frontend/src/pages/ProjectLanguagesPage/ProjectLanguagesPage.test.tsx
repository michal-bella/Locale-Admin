import { notifications } from '@mantine/notifications'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vite-plus/test'

import { type LanguageListItem, type ProjectSettings, SUPPORTED_LANGUAGES } from '@locale/shared'

import http from '@/api/http'
import queryClient from '@/api/queryClient'
import { QUERY_KEYS } from '@/api/queryKeys'
import i18n from '@/lib/i18n'
import { ADMIN_USER, apiError, EDITOR_USER, projectListRoute, signedInAs } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'

const toLanguage = (tag: LanguageListItem['tag'], index: number, isBase = false): LanguageListItem => {
	const supported = SUPPORTED_LANGUAGES.find((language) => language.tag === tag)
	if (!supported) {
		throw new Error(`Unknown tag ${tag}`)
	}
	return {
		id: `00000000-0000-4000-8000-0000000001${String(index).padStart(2, '0')}`,
		...supported,
		isBase,
		createdAt: '2026-10-17T10:00:00.000Z',
		translatedCount: 0,
		keyCount: 0,
	}
}

const SLOVAK = toLanguage('sk', 1, true)
const ENGLISH = toLanguage('en', 2)
const RUSSIAN = toLanguage('ru', 3)
const ALL_LANGUAGES = SUPPORTED_LANGUAGES.map((language, index) => toLanguage(language.tag, 10 + index, language.tag === 'sk'))

const PROJECT: ProjectSettings = {
	id: '00000000-0000-4000-8000-000000000301',
	name: 'Booking Web',
	slug: 'booking-web',
	primaryColor: '#E83E8C',
	protectVariables: true,
	baseLanguageId: null,
}

const PAGE_PATH = `/projects/${PROJECT.slug}/languages`

const LIST_URL = `/projects/${PROJECT.id}/languages`

/** The project route resolves the slug and loads the settings before the page renders. */
const PROJECT_ROUTES = { ...projectListRoute(PROJECT), [`GET /projects/${PROJECT.id}/settings`]: { status: 200, data: PROJECT } }

const languagesResponse = (languages: LanguageListItem[]) => ({ status: 200, data: languages })

const getTable = (label = 'Zoznam jazykov') => screen.getByRole('table', { name: label })

/** The top bar's language switcher shows "Slovenčina" too. */
const findInTable = async (name: string) => within(await screen.findByRole('table', { name: 'Zoznam jazykov' })).findByText(name)

const getRow = (name: string, tableLabel?: string) => {
	const row = within(getTable(tableLabel)).getByText(name).closest('tr')
	if (!row) {
		throw new Error(`Row ${name} not found`)
	}
	return row
}

const bodyOf = (request: InternalAxiosRequestConfig | undefined) => JSON.parse(request?.data as string) as unknown

const clickRemove = async (name: string) => {
	fireEvent.click(await screen.findByRole('button', { name: `Odobrať jazyk ${name}` }))
}

const openAddModal = async () => {
	fireEvent.click(await screen.findByRole('button', { name: 'Pridať jazyk' }))
	return screen.findByRole('dialog', { name: 'Pridať jazyk' })
}

const pickOption = async (input: HTMLElement, name: string) => {
	fireEvent.click(input)
	fireEvent.click(await screen.findByRole('option', { name }))
}

/** GET returns the current list, DELETE removes the language from it. */
const mockLanguagesApi = (initial: LanguageListItem[]) => {
	let languages = initial
	const requests = signedInAs(ADMIN_USER, {
		...PROJECT_ROUTES,
		[`GET ${LIST_URL}`]: () => languagesResponse(languages),
		...Object.fromEntries(
			initial.map((language) => [
				`DELETE ${LIST_URL}/${language.id}`,
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
	queryClient.setQueryDefaults(QUERY_KEYS.PROJECTS.LANGUAGES(PROJECT.id), { retry: false })
})

afterEach(() => {
	vi.restoreAllMocks()
})

describe('ProjectLanguagesPage table', () => {
	it('renders the header and rows with flags, names, tags and the base badge', async () => {
		signedInAs(ADMIN_USER, {
			...PROJECT_ROUTES,
			[`GET ${LIST_URL}`]: languagesResponse([SLOVAK, ENGLISH]),
		})
		renderApp(PAGE_PATH)

		expect(await findInTable('Slovenčina')).toBeInTheDocument()
		expect(screen.getByText('Lokalizácia')).toBeInTheDocument()
		expect(screen.getByRole('heading', { level: 1, name: 'Jazyky' })).toBeInTheDocument()
		expect(
			screen.getByText(
				'Jazyky, do ktorých sa projekt prekladá. Poradie zmeníte potiahnutím – v tomto poradí sa zobrazia stĺpce v prekladoch a jazyk na prvom mieste je základný.',
			),
		).toBeInTheDocument()
		expect(within(getTable()).getByRole('columnheader', { name: 'Jazyk' })).toBeInTheDocument()
		expect(within(getTable()).getByRole('columnheader', { name: 'Akcie' })).toBeInTheDocument()
		expect(within(getTable()).getAllByRole('row').slice(1)).toHaveLength(2)

		const slovakRow = getRow('Slovenčina')
		expect(within(slovakRow).getByText('slovenčina · sk')).toBeInTheDocument()
		expect(within(slovakRow).getByText('Základný')).toBeInTheDocument()
		expect(slovakRow.querySelector('[data-flag="sk"]')).not.toBeNull()

		const englishRow = getRow('Angličtina')
		expect(within(englishRow).getByText('English · en')).toBeInTheDocument()
		expect(within(englishRow).queryByText('Základný')).not.toBeInTheDocument()
		expect(englishRow.querySelector('[data-flag="gb"]')).not.toBeNull()
	})

	it('shows the translated keys and the coverage of every language', async () => {
		signedInAs(ADMIN_USER, {
			...PROJECT_ROUTES,
			[`GET ${LIST_URL}`]: languagesResponse([
				{ ...SLOVAK, translatedCount: 248, keyCount: 248 },
				{ ...ENGLISH, translatedCount: 221, keyCount: 248 },
				{ ...RUSSIAN, translatedCount: 247, keyCount: 248 },
			]),
		})
		renderApp(PAGE_PATH)

		await findInTable('Slovenčina')
		expect(within(getTable()).getByRole('columnheader', { name: 'Preložené' })).toBeInTheDocument()
		expect(within(getTable()).getByRole('columnheader', { name: 'Pokrytie' })).toBeInTheDocument()
		expect(within(getRow('Slovenčina')).getByText('248 / 248')).toBeInTheDocument()
		expect(within(getRow('Angličtina')).getByText('221 / 248')).toBeInTheDocument()
		// The column and the narrow-screen copies under the bar and under the name; CSS shows one of them per breakpoint.
		expect(within(getRow('Angličtina')).getAllByText('221 z 248 preložených')).toHaveLength(2)
		expect(within(getRow('Slovenčina')).getAllByText('100 %')).toHaveLength(2)
		expect(within(getRow('Angličtina')).getAllByRole('progressbar', { name: 'Pokrytie jazyka Angličtina: 89\u00a0%' })).toHaveLength(2)
		// 99.6 % is not shown as 100 % while a key is missing.
		expect(within(getRow('Ruština')).getAllByText('> 99 %')).toHaveLength(2)
	})

	it('shows skeleton rows while loading and keeps Pridať jazyk disabled', async () => {
		signedInAs(ADMIN_USER, PROJECT_ROUTES)
		const adapter = http.defaults.adapter as AxiosAdapter
		http.defaults.adapter = (config) => (config.url === LIST_URL ? new Promise(() => undefined) : adapter(config))
		renderApp(PAGE_PATH)

		await screen.findByRole('heading', { level: 1, name: 'Jazyky' })
		expect(getTable()).toHaveAttribute('aria-busy', 'true')
		expect(within(getTable()).getAllByRole('row').slice(1)).toHaveLength(3)
		expect(screen.getByRole('button', { name: 'Pridať jazyk' })).toBeDisabled()
	})

	it('shows the empty state with a button that opens the add modal', async () => {
		signedInAs(ADMIN_USER, {
			...PROJECT_ROUTES,
			[`GET ${LIST_URL}`]: languagesResponse([]),
		})
		renderApp(PAGE_PATH)

		expect(await screen.findByText('Projekt zatiaľ nemá žiadne jazyky.')).toBeInTheDocument()
		expect(getTable()).toHaveAttribute('aria-busy', 'false')
		fireEvent.click(within(getTable()).getByRole('button', { name: 'Pridať jazyk' }))

		expect(await screen.findByRole('dialog', { name: 'Pridať jazyk' })).toBeInTheDocument()
	})

	it('hides Pridať jazyk from an EDITOR, also in the empty state', async () => {
		signedInAs(EDITOR_USER, {
			...PROJECT_ROUTES,
			[`GET ${LIST_URL}`]: languagesResponse([]),
		})
		renderApp(PAGE_PATH)

		expect(await screen.findByText('Projekt zatiaľ nemá žiadne jazyky.')).toBeInTheDocument()
		expect(screen.queryByRole('button', { name: 'Pridať jazyk' })).not.toBeInTheDocument()
	})

	it('shows the translated load error and retries', async () => {
		let backendUp = false
		signedInAs(ADMIN_USER, {
			...PROJECT_ROUTES,
			[`GET ${LIST_URL}`]: () => (backendUp ? languagesResponse([SLOVAK]) : apiError(500, 'INTERNAL_ERROR')),
		})
		renderApp(PAGE_PATH)

		expect(await screen.findByText('Zoznam jazykov sa nepodarilo načítať.')).toBeInTheDocument()
		expect(screen.getByText('Nastala neočakávaná chyba. Skúste to znova.')).toBeInTheDocument()
		expect(screen.queryByText('English message that must not be shown')).not.toBeInTheDocument()

		backendUp = true
		const retry = screen.getByRole('button', { name: 'Skúsiť znova' })
		retry.focus()
		fireEvent.click(retry)

		expect(await findInTable('Slovenčina')).toBeInTheDocument()
		await waitFor(() => expect(getTable()).toHaveFocus())
	})

	it('renders texts in en', async () => {
		await i18n.changeLanguage('en')
		signedInAs(ADMIN_USER, {
			...PROJECT_ROUTES,
			[`GET ${LIST_URL}`]: languagesResponse([SLOVAK]),
		})
		renderApp(PAGE_PATH)

		expect(await screen.findByText('Slovak')).toBeInTheDocument()
		expect(screen.getByRole('heading', { level: 1, name: 'Languages' })).toBeInTheDocument()
		expect(within(getRow('Slovak', 'Language list')).getByText('Base')).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Add language' })).toBeEnabled()
	})
})

describe('Reordering languages', () => {
	const rowNames = () =>
		within(getTable())
			.getAllByRole('row')
			.slice(1)
			.map((row) => within(row).getAllByText(/./)[0]?.textContent)

	/** GET returns the current list, PUT …/order saves the order and makes the first language the base. */
	const mockReorderApi = (initial: LanguageListItem[]) => {
		let languages = initial
		return signedInAs(ADMIN_USER, {
			...PROJECT_ROUTES,
			[`GET ${LIST_URL}`]: () => languagesResponse(languages),
			[`PUT ${LIST_URL}/order`]: (config) => {
				const { languageIds } = bodyOf(config) as { languageIds: string[] }
				languages = languageIds.flatMap((id, index) =>
					initial.filter((language) => language.id === id).map((language) => ({ ...language, isBase: index === 0 })),
				)
				return languagesResponse(languages)
			},
		})
	}

	const puts = (requests: InternalAxiosRequestConfig[]) => requests.filter((request) => request.method === 'put').map((request) => bodyOf(request))

	const pressArrow = async (name: string, key: 'ArrowUp' | 'ArrowDown') => {
		const grip = await screen.findByRole('button', { name: `Presunúť jazyk ${name}` })
		grip.focus()
		fireEvent.keyDown(grip, { key })
	}

	it('shows the names in the UI language with the native name and tag under them', async () => {
		mockReorderApi([SLOVAK, ENGLISH])
		renderApp(PAGE_PATH)

		expect(await screen.findByText('Angličtina')).toBeInTheDocument()
		expect(within(getRow('Angličtina')).getByText('English · en')).toBeInTheDocument()
	})

	it('saves a move that keeps the base language without asking', async () => {
		const requests = mockReorderApi([SLOVAK, ENGLISH, RUSSIAN])
		renderApp(PAGE_PATH)

		await pressArrow('Ruština', 'ArrowUp')

		await waitFor(() => expect(puts(requests)).toEqual([{ languageIds: [SLOVAK.id, RUSSIAN.id, ENGLISH.id] }]))
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
		await waitFor(() => expect(rowNames()).toEqual(['Slovenčina', 'Ruština', 'Angličtina']))
		expect(screen.getByRole('status')).toHaveTextContent('Jazyk Ruština je na 2. mieste z 3.')
	})

	it('asks before a new first language becomes the base; Nie puts the rows back and saves nothing', async () => {
		const requests = mockReorderApi([SLOVAK, ENGLISH])
		renderApp(PAGE_PATH)

		await pressArrow('Angličtina', 'ArrowUp')

		const dialog = await screen.findByRole('dialog', { name: 'Zmeniť základný jazyk' })
		expect(
			within(dialog).getByText(
				'Jazyk na prvom mieste je základný. Presunutím sa základným jazykom projektu stane angličtina namiesto slovenčina. Zmena sa prejaví aj v nastaveniach projektu.',
			),
		).toBeInTheDocument()
		expect(rowNames()).toEqual(['Angličtina', 'Slovenčina'])
		fireEvent.click(within(dialog).getByRole('button', { name: 'Nie, vrátiť' }))

		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
		expect(rowNames()).toEqual(['Slovenčina', 'Angličtina'])
		expect(puts(requests)).toEqual([])
	})

	it('Áno saves the order and moves the base badge to the new first language', async () => {
		const show = vi.spyOn(notifications, 'show')
		const requests = mockReorderApi([SLOVAK, ENGLISH])
		renderApp(PAGE_PATH)

		await pressArrow('Slovenčina', 'ArrowDown')
		fireEvent.click(within(await screen.findByRole('dialog', { name: 'Zmeniť základný jazyk' })).getByRole('button', { name: 'Áno, zmeniť' }))

		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
		expect(puts(requests)).toEqual([{ languageIds: [ENGLISH.id, SLOVAK.id] }])
		await waitFor(() => expect(within(getRow('Angličtina')).getByText('Základný')).toBeInTheDocument())
		expect(within(getRow('Slovenčina')).queryByText('Základný')).not.toBeInTheDocument()
		expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'green', message: 'Základný jazyk je teraz Angličtina.' }))
	})

	it('restores the order and shows the translated error when saving fails', async () => {
		const show = vi.spyOn(notifications, 'show')
		signedInAs(ADMIN_USER, {
			...PROJECT_ROUTES,
			[`GET ${LIST_URL}`]: languagesResponse([SLOVAK, ENGLISH, RUSSIAN]),
			[`PUT ${LIST_URL}/order`]: apiError(400, 'VALIDATION_ERROR'),
		})
		renderApp(PAGE_PATH)

		await pressArrow('Ruština', 'ArrowUp')

		await waitFor(() => expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'red' })))
		await waitFor(() => expect(rowNames()).toEqual(['Slovenčina', 'Angličtina', 'Ruština']))
	})

	it('has no grip with a single language', async () => {
		mockReorderApi([SLOVAK])
		renderApp(PAGE_PATH)

		await findInTable('Slovenčina')
		expect(screen.queryByRole('button', { name: 'Presunúť jazyk Slovenčina' })).not.toBeInTheDocument()
	})

	it('has no grips for an EDITOR and does not tell them to drag', async () => {
		signedInAs(EDITOR_USER, {
			...PROJECT_ROUTES,
			[`GET ${LIST_URL}`]: languagesResponse([SLOVAK, ENGLISH]),
		})
		renderApp(PAGE_PATH)

		await findInTable('Angličtina')
		expect(screen.queryByRole('button', { name: /^Presunúť jazyk/ })).not.toBeInTheDocument()
		expect(
			screen.getByText('Jazyky, do ktorých sa projekt prekladá. V tomto poradí sa zobrazia stĺpce v prekladoch a jazyk na prvom mieste je základný.'),
		).toBeInTheDocument()
	})
})

describe('AddLanguageModal', () => {
	it('disables already added languages and adds the selected one', async () => {
		const show = vi.spyOn(notifications, 'show')
		let languages = [SLOVAK, ENGLISH]
		const requests = signedInAs(ADMIN_USER, {
			...PROJECT_ROUTES,
			[`GET ${LIST_URL}`]: () => languagesResponse(languages),
			[`POST ${LIST_URL}`]: () => {
				languages = [...languages, RUSSIAN]
				return { status: 201, data: RUSSIAN }
			},
		})
		renderApp(PAGE_PATH)
		await findInTable('Slovenčina')
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
		expect(await screen.findByText('Ruština')).toBeInTheDocument()
		const posts = requests.filter((request) => request.method === 'post' && request.url === LIST_URL)
		expect(posts).toHaveLength(1)
		expect(bodyOf(posts[0])).toEqual({ tag: 'ru' })
		expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'green', message: 'Jazyk ruština bol pridaný.' }))
	})

	it('searches by tag', async () => {
		signedInAs(ADMIN_USER, {
			...PROJECT_ROUTES,
			[`GET ${LIST_URL}`]: languagesResponse([SLOVAK]),
		})
		renderApp(PAGE_PATH)
		await findInTable('Slovenčina')
		const dialog = await openAddModal()

		const input = within(dialog).getByLabelText('Jazyk', { selector: 'input' })
		fireEvent.click(input)
		fireEvent.change(input, { target: { value: 'de-AT' } })

		expect(await screen.findByRole('option', { name: 'German (Austria) – Deutsch (Österreich) – de-AT' })).toBeInTheDocument()
		expect(screen.getAllByRole('option')).toHaveLength(1)
	})

	it('disables Pridať jazyk when every supported language is added', async () => {
		signedInAs(ADMIN_USER, {
			...PROJECT_ROUTES,
			[`GET ${LIST_URL}`]: languagesResponse(ALL_LANGUAGES),
		})
		renderApp(PAGE_PATH)

		await findInTable('Slovenčina')
		expect(screen.getByRole('button', { name: 'Pridať jazyk' })).toBeDisabled()
	})

	it('shows 409 LANGUAGE_TAKEN at the field, clears the selection and refetches the list', async () => {
		const show = vi.spyOn(notifications, 'show')
		let languages = [SLOVAK]
		const requests = signedInAs(ADMIN_USER, {
			...PROJECT_ROUTES,
			[`GET ${LIST_URL}`]: () => languagesResponse(languages),
			[`POST ${LIST_URL}`]: () => {
				languages = [SLOVAK, RUSSIAN]
				return apiError(409, 'LANGUAGE_TAKEN')
			},
		})
		renderApp(PAGE_PATH)
		await findInTable('Slovenčina')
		const dialog = await openAddModal()

		const input = within(dialog).getByLabelText('Jazyk', { selector: 'input' })
		const submit = within(dialog).getByRole('button', { name: 'Pridať' })
		await pickOption(input, 'Russian – русский – ru')
		submit.focus()
		fireEvent.click(submit)

		expect(await within(dialog).findByText('Tento jazyk je už pridaný.')).toBeInTheDocument()
		expect(input).toHaveAttribute('aria-invalid', 'true')
		expect(input).toHaveFocus()
		expect(input).toHaveValue('')
		expect(submit).toBeDisabled()
		expect(show).not.toHaveBeenCalledWith(expect.objectContaining({ color: 'red' }))
		expect(screen.getByRole('dialog', { name: 'Pridať jazyk' })).toBeInTheDocument()
		await waitFor(() => expect(requests.filter((request) => request.method === 'get' && request.url === LIST_URL)).toHaveLength(2))

		fireEvent.click(input)
		await waitFor(() => expect(screen.getByRole('option', { name: 'Russian – русский – ru' })).toHaveAttribute('data-combobox-disabled', 'true'))
		fireEvent.click(screen.getByRole('option', { name: 'English – English – en' }))
		expect(within(dialog).queryByText('Tento jazyk je už pridaný.')).not.toBeInTheDocument()
		expect(input).not.toHaveAttribute('aria-invalid')
		expect(submit).toBeEnabled()
	})
})

describe('Deleting a language', () => {
	it('shows no Odobrať to an EDITOR, only the link to the translations', async () => {
		signedInAs(EDITOR_USER, {
			...PROJECT_ROUTES,
			[`GET ${LIST_URL}`]: languagesResponse([SLOVAK, ENGLISH]),
		})
		renderApp(PAGE_PATH)

		const table = await screen.findByRole('table', { name: 'Zoznam jazykov' })
		expect(await within(table).findByText('Angličtina')).toBeInTheDocument()
		expect(screen.queryByRole('button', { name: /^Odobrať jazyk/ })).not.toBeInTheDocument()
		expect(within(table).getByRole('link', { name: 'Otvoriť preklady do jazyka Angličtina' })).toHaveAttribute(
			'href',
			expect.stringMatching(/\/translations\?target=en&languages=.*en/),
		)
	})

	it('disables Odobrať in the row of the base language', async () => {
		signedInAs(ADMIN_USER, {
			...PROJECT_ROUTES,
			[`GET ${LIST_URL}`]: languagesResponse([SLOVAK, ENGLISH]),
		})
		renderApp(PAGE_PATH)

		expect(await screen.findByRole('button', { name: 'Odobrať jazyk Slovenčina' })).toBeDisabled()
		expect(screen.getByRole('button', { name: 'Odobrať jazyk Angličtina' })).toBeEnabled()
	})

	it('asks for confirmation from the row button; Zrušiť removes nothing, Odobrať removes', async () => {
		const show = vi.spyOn(notifications, 'show')
		const requests = mockLanguagesApi([SLOVAK, ENGLISH])
		renderApp(PAGE_PATH)

		await clickRemove('Angličtina')
		let confirm = await screen.findByRole('dialog', { name: 'Odobrať jazyk' })
		expect(within(confirm).getByText('Naozaj chcete odobrať jazyk angličtina (en) z projektu?')).toBeInTheDocument()
		fireEvent.click(within(confirm).getByRole('button', { name: 'Zrušiť' }))
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
		expect(requests.some((request) => request.method === 'delete')).toBe(false)
		expect(getRow('Angličtina')).toBeInTheDocument()

		await clickRemove('Angličtina')
		confirm = await screen.findByRole('dialog', { name: 'Odobrať jazyk' })
		fireEvent.click(within(confirm).getByRole('button', { name: 'Odobrať' }))

		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
		await waitFor(() => expect(within(getTable()).queryByText('Angličtina')).not.toBeInTheDocument())
		expect(requests.filter((request) => request.method === 'delete').map((request) => request.url)).toEqual([`${LIST_URL}/${ENGLISH.id}`])
		expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'green', message: 'Jazyk angličtina bol odobraný z projektu.' }))
	})

	it('shows 409 LANGUAGE_IS_BASE as a notification and refetches the list', async () => {
		const show = vi.spyOn(notifications, 'show')
		let languages = [SLOVAK, ENGLISH]
		const requests = signedInAs(ADMIN_USER, {
			...PROJECT_ROUTES,
			[`GET ${LIST_URL}`]: () => languagesResponse(languages),
			[`DELETE ${LIST_URL}/${ENGLISH.id}`]: () => {
				// Another member made English the base language in the meantime.
				languages = [
					{ ...ENGLISH, isBase: true },
					{ ...SLOVAK, isBase: false },
				]
				return apiError(409, 'LANGUAGE_IS_BASE')
			},
		})
		renderApp(PAGE_PATH)

		await clickRemove('Angličtina')
		const confirm = await screen.findByRole('dialog', { name: 'Odobrať jazyk' })
		fireEvent.click(within(confirm).getByRole('button', { name: 'Odobrať' }))

		await waitFor(() =>
			expect(show).toHaveBeenCalledWith(
				expect.objectContaining({ color: 'red', message: 'Základný jazyk nie je možné odstrániť. Najprv nastavte iný základný jazyk.' }),
			),
		)
		expect(screen.getByRole('dialog', { name: 'Odobrať jazyk' })).toBeInTheDocument()
		await waitFor(() => expect(requests.filter((request) => request.method === 'get' && request.url === LIST_URL)).toHaveLength(2))
		await waitFor(() => expect(within(getRow('Angličtina')).getByText('Základný')).toBeInTheDocument())
		expect(within(getRow('Slovenčina')).queryByText('Základný')).not.toBeInTheDocument()
	})
})

describe('Focus after a modal closes', () => {
	/** fireEvent.click does not move focus like a real click or Enter does. */
	const press = (element: HTMLElement) => {
		element.focus()
		fireEvent.click(element)
	}

	const openRemove = async (name: string) => {
		press(await screen.findByRole('button', { name: `Odobrať jazyk ${name}` }))
		return screen.findByRole('dialog', { name: 'Odobrať jazyk' })
	}

	it('returns to the row button after the remove confirmation is cancelled', async () => {
		mockLanguagesApi([SLOVAK, ENGLISH])
		renderApp(PAGE_PATH)
		const trigger = await screen.findByRole('button', { name: 'Odobrať jazyk Angličtina' })

		const confirm = await openRemove('Angličtina')
		press(within(confirm).getByRole('button', { name: 'Zrušiť' }))
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
		expect(trigger).toHaveFocus()
	})

	it('moves focus to the table after the row is deleted', async () => {
		mockLanguagesApi([SLOVAK, ENGLISH])
		renderApp(PAGE_PATH)

		const confirm = await openRemove('Angličtina')
		press(within(confirm).getByRole('button', { name: 'Odobrať' }))

		await waitFor(() => expect(within(getTable()).queryByText('Angličtina')).not.toBeInTheDocument())
		expect(getTable()).toHaveFocus()
	})

	it('moves focus to the table when the empty-state button is gone after adding a language', async () => {
		let languages: LanguageListItem[] = []
		signedInAs(ADMIN_USER, {
			...PROJECT_ROUTES,
			[`GET ${LIST_URL}`]: () => languagesResponse(languages),
			[`POST ${LIST_URL}`]: () => {
				languages = [RUSSIAN]
				return { status: 201, data: RUSSIAN }
			},
		})
		renderApp(PAGE_PATH)
		await screen.findByText('Projekt zatiaľ nemá žiadne jazyky.')

		press(within(getTable()).getByRole('button', { name: 'Pridať jazyk' }))
		const dialog = await screen.findByRole('dialog', { name: 'Pridať jazyk' })
		await pickOption(within(dialog).getByLabelText('Jazyk', { selector: 'input' }), 'Russian – русский – ru')
		press(within(dialog).getByRole('button', { name: 'Pridať' }))

		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
		expect(await within(getTable()).findByText('Ruština')).toBeInTheDocument()
		expect(getTable()).toHaveFocus()
	})
})
