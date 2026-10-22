import { notifications } from '@mantine/notifications'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { type InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { type ExportCheckResponse, type Language, type ProjectSettings, SUPPORTED_LANGUAGES, type TranslationsResponse } from '@locale/shared'

import queryClient from '@/api/queryClient'
import { QUERY_KEYS } from '@/api/queryKeys'
import { ADMIN_USER, apiError, projectListRoute, signedInAs } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'

const toLanguage = (tag: Language['tag'], index: number, isBase = false): Language => {
	const supported = SUPPORTED_LANGUAGES.find((language) => language.tag === tag)
	if (!supported) {
		throw new Error(`Unknown tag ${tag}`)
	}
	return { id: `00000000-0000-4000-8000-0000000001${String(index).padStart(2, '0')}`, ...supported, isBase, createdAt: '2026-10-17T10:00:00.000Z' }
}

const SLOVAK = toLanguage('sk', 1, true)
const ENGLISH = toLanguage('en', 2)
const GERMAN = toLanguage('de-AT', 3)

const PROJECT: ProjectSettings = {
	id: '00000000-0000-4000-8000-000000000301',
	name: 'Booking Web',
	slug: 'booking-web',
	primaryColor: '#E83E8C',
	protectVariables: true,
	baseLanguageId: SLOVAK.id,
}

const PAGE_PATH = `/projects/${PROJECT.slug}/translations`
const EXPORT_URL = `/projects/${PROJECT.id}/export`

const TRANSLATIONS: TranslationsResponse = {
	items: [],
	total: 0,
	page: 1,
	pageSize: 20,
	stats: { totalKeys: 0, translated: 0, untranslated: 0, warnings: 0 },
	namespaces: [],
	editors: [],
}

const CSV = 'Keys; sk ; en ; de-AT \n--loc--\n Áno; Áno; Yes; Ja\n'

type MockResponse = { status: number; data?: unknown; headers?: Record<string, string> }

const CHECK_URL = `${EXPORT_URL}/check`

const NO_WARNINGS: ExportCheckResponse = { warnings: [], total: 0 }

const mockPage = (
	exportResponse: MockResponse = { status: 200, data: new Blob([CSV], { type: 'text/csv' }) },
	checkResponse: MockResponse = { status: 200, data: NO_WARNINGS },
) =>
	signedInAs(ADMIN_USER, {
		...projectListRoute(PROJECT),
		[`GET /projects/${PROJECT.id}/settings`]: { status: 200, data: PROJECT },
		[`GET /projects/${PROJECT.id}/languages`]: { status: 200, data: [SLOVAK, ENGLISH, GERMAN] },
		[`GET /projects/${PROJECT.id}/versions`]: { status: 200, data: { items: [] } },
		[`GET /projects/${PROJECT.id}/translations`]: { status: 200, data: TRANSLATIONS },
		[`GET ${EXPORT_URL}`]: exportResponse,
		[`GET ${CHECK_URL}`]: checkResponse,
	})

const jsonBlob = (body: unknown) => new Blob([JSON.stringify(body)], { type: 'application/json' })

const exportRequests = (requests: InternalAxiosRequestConfig[]) => requests.filter((request) => request.url === EXPORT_URL)

const openModal = async () => {
	fireEvent.click(await screen.findByRole('button', { name: 'Exportovať' }))
	return screen.findByRole('dialog', { name: 'Exportovať preklady' })
}

const submit = (dialog: HTMLElement) => fireEvent.click(within(dialog).getByRole('button', { name: 'Exportovať CSV' }))

let downloads: string[] = []

beforeAll(() => {
	queryClient.setQueryDefaults(QUERY_KEYS.PROJECTS.DETAIL(PROJECT.id), { retry: false })
})

beforeEach(() => {
	downloads = []
	// jsdom has no object URLs and does not navigate on click; the click records the file name the browser would save.
	URL.createObjectURL = vi.fn(() => 'blob:export')
	URL.revokeObjectURL = vi.fn()
	vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
		downloads.push(this.download)
	})
})

afterEach(() => {
	vi.restoreAllMocks()
})

describe('ExportModal', () => {
	it('opens from Exportovať with CSV, every language, all statuses and the default file name', async () => {
		mockPage()
		renderApp(PAGE_PATH)
		const dialog = await openModal()

		expect(within(dialog).getByText('Vyberte jazyky a formát výstupného súboru.')).toBeInTheDocument()
		expect(within(dialog).getByRole('radio', { name: /CSV/ })).toBeChecked()
		expect(within(dialog).getByRole('radio', { name: /XLSX/ })).toBeEnabled()
		for (const format of ['JSON', 'ARB']) {
			expect(within(dialog).getByRole('radio', { name: new RegExp(format) })).toBeDisabled()
		}
		expect(within(dialog).getAllByText('Čoskoro')).toHaveLength(2)
		expect(await within(dialog).findByRole('checkbox', { name: 'Slovenčina' })).toBeChecked()
		expect(within(dialog).getByRole('checkbox', { name: 'Angličtina' })).toBeChecked()
		expect(within(dialog).getByRole('checkbox', { name: 'Nemčina (Rakúsko)' })).toBeChecked()
		expect(Array.from(dialog.querySelectorAll('[data-flag]')).map((flag) => flag.getAttribute('data-flag'))).toEqual(['sk', 'gb', 'at'])
		expect(within(dialog).getByRole('radio', { name: 'Všetky' })).toBeChecked()
		expect(within(dialog).getByRole('textbox', { name: 'Názov súboru, prípona .csv sa doplní' })).toHaveValue('translations')
		expect(within(dialog).getByRole('radio', { name: /CSV/ })).toHaveFocus()
		expect(within(dialog).queryByText('Zahrnúť popisy a metadáta kľúčov')).not.toBeInTheDocument()
	})

	it('downloads translations.csv with every language in the project order and closes', async () => {
		const requests = mockPage()
		const show = vi.spyOn(notifications, 'show')
		renderApp(PAGE_PATH)
		const dialog = await openModal()
		await within(dialog).findByRole('checkbox', { name: 'Slovenčina' })

		submit(dialog)

		await waitFor(() => expect(downloads).toEqual(['translations.csv']))
		expect(exportRequests(requests)[0]?.params).toEqual({ languageIds: [SLOVAK.id, ENGLISH.id, GERMAN.id].join(','), status: 'ALL', format: 'CSV' })
		expect(exportRequests(requests)[0]?.responseType).toBe('blob')
		expect(show).toHaveBeenCalledWith(expect.objectContaining({ message: 'Preklady sa stiahli do súboru translations.csv.' }))
		await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Exportovať preklady' })).not.toBeInTheDocument())
	})

	it('sends only the checked languages and the status, and saves under the chosen name', async () => {
		const requests = mockPage()
		renderApp(PAGE_PATH)
		const dialog = await openModal()
		fireEvent.click(await within(dialog).findByRole('checkbox', { name: 'Angličtina' }))
		fireEvent.click(within(dialog).getByRole('radio', { name: 'Nepreložené' }))
		fireEvent.change(within(dialog).getByRole('textbox', { name: 'Názov súboru, prípona .csv sa doplní' }), { target: { value: ' notino-b2b.csv ' } })

		submit(dialog)

		await waitFor(() => expect(downloads).toEqual(['notino-b2b.csv']))
		expect(exportRequests(requests)[0]?.params).toEqual({ languageIds: [SLOVAK.id, GERMAN.id].join(','), status: 'UNTRANSLATED', format: 'CSV' })
	})

	it('exports XLSX: the button, the extension and the request follow the chosen format', async () => {
		const requests = mockPage()
		renderApp(PAGE_PATH)
		const dialog = await openModal()
		await within(dialog).findByRole('checkbox', { name: 'Slovenčina' })

		fireEvent.click(within(dialog).getByRole('radio', { name: /XLSX/ }))
		expect(within(dialog).getByRole('radio', { name: /XLSX/ })).toBeChecked()
		expect(within(dialog).getByRole('textbox', { name: 'Názov súboru, prípona .xlsx sa doplní' })).toBeInTheDocument()
		fireEvent.click(within(dialog).getByRole('button', { name: 'Exportovať XLSX' }))

		await waitFor(() => expect(downloads).toEqual(['translations.xlsx']))
		expect(exportRequests(requests)[0]?.params).toMatchObject({ format: 'XLSX' })
	})

	it('needs a language and a valid file name before it sends anything', async () => {
		const requests = mockPage()
		renderApp(PAGE_PATH)
		const dialog = await openModal()
		for (const name of ['Slovenčina', 'Angličtina', 'Nemčina (Rakúsko)']) {
			fireEvent.click(await within(dialog).findByRole('checkbox', { name }))
		}
		const fileName = within(dialog).getByRole('textbox', { name: 'Názov súboru, prípona .csv sa doplní' })
		fireEvent.change(fileName, { target: { value: 'preklady/sk' } })

		submit(dialog)

		expect(await within(dialog).findByText('Vyberte aspoň jeden jazyk.')).toBeInTheDocument()
		expect(within(dialog).getByRole('checkbox', { name: 'Slovenčina' })).toHaveFocus()
		expect(within(dialog).getByText('Názov súboru nesmie obsahovať znaky \\ / : * ? " < > |.')).toBeInTheDocument()
		fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Slovenčina' }))
		fireEvent.change(fileName, { target: { value: ' .csv' } })
		submit(dialog)
		expect(within(dialog).getByText('Zadajte názov súboru.')).toBeInTheDocument()
		expect(fileName).toHaveFocus()
		expect(exportRequests(requests)).toHaveLength(0)
	})

	it('lists the values that would break the CSV from the 422 blob body', async () => {
		const issue = { keyId: '00000000-0000-4000-8000-000000000501', namespace: 'loc', key: 'Ahoj' }
		mockPage({
			status: 422,
			data: jsonBlob({
				error: {
					code: 'EXPORT_VALUE_UNSAFE',
					message: 'Some values would break the CSV',
					details: {
						issues: [
							{ ...issue, code: 'SEMICOLON', languageTag: 'en' },
							{ ...issue, code: 'SECTION_MARKER', languageTag: null },
							{ ...issue, namespace: 'a--b', code: 'NAMESPACE', languageTag: null },
						],
						total: 8,
					},
				},
			}),
		})
		renderApp(PAGE_PATH)
		const dialog = await openModal()
		await within(dialog).findByRole('checkbox', { name: 'Slovenčina' })

		submit(dialog)

		const alert = await within(dialog).findByRole('alert')
		expect(within(alert).getByText('Niektoré preklady obsahujú znaky, ktoré by rozbili CSV súbor. Opravte ich a skúste to znova.')).toBeInTheDocument()
		expect(
			within(alert)
				.getAllByRole('listitem')
				.map((item) => item.textContent),
		).toEqual([
			'„loc / Ahoj“: preklad angličtina obsahuje bodkočiarku (;).',
			'„loc / Ahoj“: riadok obsahuje text v tvare --názov--, ktorý by sa načítal ako nová sekcia.',
			'Namespace „a--b“ by sa v CSV načítal inak (obsahuje -- alebo končí pomlčkou). Premenujte ho.',
		])
		expect(alert).toHaveFocus()
		expect(within(alert).getByText('… a ešte 5 ďalších.')).toBeInTheDocument()
		expect(downloads).toEqual([])
		expect(screen.getByRole('dialog', { name: 'Exportovať preklady' })).toBeInTheDocument()
	})

	it('warns about placeholder mismatches of the selected languages and still exports', async () => {
		const warning = { keyId: '00000000-0000-4000-8000-000000000501', namespace: 'loc', key: 'margin' }
		const requests = mockPage(undefined, {
			status: 200,
			data: {
				warnings: [
					{ ...warning, languageTag: 'en', missing: ['{{percentage}}'], extra: ['{{perecentage}}'] },
					{ ...warning, languageTag: 'de-AT', missing: ['{{percentage}}'], extra: [] },
				],
				total: 52,
			} satisfies ExportCheckResponse,
		})
		renderApp(PAGE_PATH)
		const dialog = await openModal()

		expect(await within(dialog).findByText('52 upozornení')).toBeInTheDocument()
		expect(
			within(dialog).getByText('Tieto preklady majú iné premenné ako základný jazyk. Export prebehne aj tak, ale pred ním ich odporúčame opraviť.'),
		).toBeInTheDocument()
		expect(
			within(dialog)
				.getAllByRole('listitem')
				.map((item) => item.textContent),
		).toEqual(['„loc / margin“ (angličtina): chýba {{percentage}}, navyše {{perecentage}}.', '„loc / margin“ (nemčina (Rakúsko)): chýba {{percentage}}.'])
		expect(within(dialog).getByText('… a ešte 50 ďalších.')).toBeInTheDocument()
		const checks = () => requests.filter((request) => request.url === CHECK_URL)
		expect(checks().at(-1)?.params).toEqual({ languageIds: `${SLOVAK.id},${ENGLISH.id},${GERMAN.id}`, status: 'ALL' })

		// A changed selection checks again with the new languages and status.
		fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Angličtina' }))
		fireEvent.click(within(dialog).getByRole('radio', { name: 'Nepreložené' }))
		await waitFor(() => expect(checks().at(-1)?.params).toEqual({ languageIds: `${SLOVAK.id},${GERMAN.id}`, status: 'UNTRANSLATED' }))

		submit(dialog)
		await waitFor(() => expect(downloads).toEqual(['translations.csv']))
	})

	it('shows no warning block when the check finds nothing', async () => {
		mockPage()
		renderApp(PAGE_PATH)
		const dialog = await openModal()
		await within(dialog).findByRole('checkbox', { name: 'Slovenčina' })
		expect(within(dialog).queryByText(/upozorn/)).not.toBeInTheDocument()
	})

	it('shows the translated 429 when too many exports run', async () => {
		mockPage({ ...apiError(429, 'EXPORT_BUSY'), data: jsonBlob({ error: { code: 'EXPORT_BUSY', message: 'Too many exports at once' } }) })
		renderApp(PAGE_PATH)
		const dialog = await openModal()
		await within(dialog).findByRole('checkbox', { name: 'Slovenčina' })

		submit(dialog)

		const alert = await within(dialog).findByRole('alert')
		expect(alert).toHaveTextContent('Export práve robí veľa ľudí naraz. Skúste to o chvíľu znova.')
		expect(alert).toHaveFocus()
		expect(downloads).toEqual([])
	})
})
