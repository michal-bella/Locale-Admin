import { notifications } from '@mantine/notifications'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { type InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vite-plus/test'

import {
	IMPORT_FILE_MAX_BYTES,
	type ImportPreviewResponse,
	type Language,
	type ProjectSettings,
	SUPPORTED_LANGUAGES,
	type TranslationsResponse,
} from '@locale/shared'

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
const RUSSIAN = toLanguage('ru', 3)

const PROJECT: ProjectSettings = {
	id: '00000000-0000-4000-8000-000000000301',
	name: 'Booking Web',
	slug: 'booking-web',
	primaryColor: '#E83E8C',
	protectVariables: true,
	baseLanguageId: SLOVAK.id,
}

const PAGE_PATH = `/projects/${PROJECT.slug}/translations`
const PREVIEW_URL = `/projects/${PROJECT.id}/imports/preview`
const IMPORT_URL = `/projects/${PROJECT.id}/imports`
const LANGUAGES_URL = `/projects/${PROJECT.id}/languages`
const TRANSLATIONS_URL = `/projects/${PROJECT.id}/translations`

const CSV = 'Keys; sk; ru\n--common--\nUložiť; Uložiť; null\n'

const TRANSLATIONS: TranslationsResponse = {
	items: [],
	total: 0,
	page: 1,
	pageSize: 50,
	stats: { totalKeys: 4, translated: 4, untranslated: 0 },
	namespaces: ['common'],
}

const PREVIEW: ImportPreviewResponse = {
	columns: [
		{ tag: 'sk', columnIndex: 2, match: 'PROJECT', languageId: SLOVAK.id, stats: { translations: 5, untranslated: 1, warnings: 1 } },
		{ tag: 'ru', columnIndex: 3, match: 'CATALOG', stats: { translations: 2, untranslated: 4, warnings: 0 } },
	],
	keys: { total: 6, new: 2, existing: 4 },
	namespaces: [{ namespace: 'common', keys: 6 }],
	changes: [{ tag: 'sk', columnIndex: 2, new: 3, changed: 1, unchanged: 2, keptBecauseNull: 0 }],
	warnings: [
		{ code: 'LANGUAGE_NOT_IN_PROJECT', line: 1, column: 3, params: { tag: 'ru' } },
		{ code: 'BASE_LANGUAGE_UNTRANSLATED', line: 6, column: 2, params: { tag: 'sk', key: 'Nový kľúč', namespace: 'common' } },
	],
	warningsTotal: 2,
}

/** The same file after `ru` was added to the project. */
const PREVIEW_WITH_RUSSIAN: ImportPreviewResponse = {
	...PREVIEW,
	columns: [
		PREVIEW.columns[0]!,
		{ tag: 'ru', columnIndex: 3, match: 'PROJECT', languageId: RUSSIAN.id, stats: { translations: 2, untranslated: 4, warnings: 0 } },
	],
	changes: [...PREVIEW.changes, { tag: 'ru', columnIndex: 3, new: 2, changed: 0, unchanged: 4, keptBecauseNull: 0 }],
	warnings: [PREVIEW.warnings[1]!],
	warningsTotal: 1,
}

type MockResponse = { status: number; data?: unknown }

type Routes = Record<string, MockResponse | ((config: InternalAxiosRequestConfig) => MockResponse)>

const mockPage = (routes: Routes = {}, languages: Language[] = [SLOVAK, ENGLISH]) =>
	signedInAs(ADMIN_USER, {
		...projectListRoute(PROJECT),
		[`GET /projects/${PROJECT.id}/settings`]: { status: 200, data: PROJECT },
		[`GET ${LANGUAGES_URL}`]: { status: 200, data: languages },
		[`GET ${TRANSLATIONS_URL}`]: { status: 200, data: TRANSLATIONS },
		[`POST ${PREVIEW_URL}`]: { status: 200, data: PREVIEW },
		...routes,
	})

const bodyOf = (request: InternalAxiosRequestConfig | undefined) => JSON.parse(request?.data as string) as unknown

const sent = (requests: InternalAxiosRequestConfig[], method: string, url: string) =>
	requests.filter((request) => request.method === method && request.url === url)

const openModal = async () => {
	fireEvent.click(await screen.findByRole('button', { name: 'Importovať' }))
	return screen.findByRole('dialog', { name: 'Importovať preklady' })
}

const chooseFile = (dialog: HTMLElement, file: File) => {
	fireEvent.change(within(dialog).getByLabelText('Súbor s prekladmi'), { target: { files: [file] } })
}

const csvFile = (name = 'preklady.csv', content = CSV) => new File([content], name, { type: 'text/csv' })

/** Opens the modal, picks a valid file and goes to the review step. */
const goToReview = async () => {
	const dialog = await openModal()
	chooseFile(dialog, csvFile())
	await within(dialog).findByText('preklady.csv')
	fireEvent.click(within(dialog).getByRole('button', { name: 'Pokračovať na kontrolu' }))
	await within(dialog).findByRole('table', { name: 'Stĺpce jazykov v súbore' })
	return dialog
}

const languageSelect = (dialog: HTMLElement, tag: string) => within(dialog).getByRole('combobox', { name: `Jazyk pre stĺpec ${tag}` })

const summaryItems = (dialog: HTMLElement) =>
	within(within(dialog).getByRole('list', { name: 'Súhrn' }))
		.getAllByRole('listitem')
		.map((item) => item.textContent)

const pickOption = async (select: HTMLElement, name: string) => {
	fireEvent.click(select)
	fireEvent.click(await screen.findByRole('option', { name }))
}

beforeAll(() => {
	queryClient.setQueryDefaults(QUERY_KEYS.PROJECTS.DETAIL(PROJECT.id), { retry: false })
})

afterEach(() => {
	vi.restoreAllMocks()
})

describe('ImportModal step 1 (upload)', () => {
	it('opens from Importovať with the dropzone, CSV chip, checked checkbox and a disabled continue button', async () => {
		mockPage()
		renderApp(PAGE_PATH)
		const dialog = await openModal()

		expect(within(dialog).getByText('Nahrajte súbor a skontrolujte zmeny pred importom.')).toBeInTheDocument()
		expect(within(dialog).getByText('Krok 1 z 2 · Nahratie')).toBeInTheDocument()
		expect(within(dialog).getByText('Presuňte súbor sem alebo kliknite pre výber')).toBeInTheDocument()
		expect(within(dialog).getByText('CSV · maximálne 10 MB')).toBeInTheDocument()
		expect(within(dialog).getByText('CSV')).toBeInTheDocument()
		expect(within(dialog).getByLabelText('Súbor s prekladmi')).toHaveAttribute('accept', '.csv,text/csv')
		expect(within(dialog).getByRole('checkbox', { name: 'Vytvoriť chýbajúce kľúče' })).toBeChecked()
		expect(within(dialog).getByRole('button', { name: 'Pokračovať na kontrolu' })).toBeDisabled()
	})

	it('shows the chosen file with its size and enables the continue button', async () => {
		mockPage()
		renderApp(PAGE_PATH)
		const dialog = await openModal()

		chooseFile(dialog, csvFile())

		expect(await within(dialog).findByText('preklady.csv')).toBeInTheDocument()
		expect(within(dialog).getByText(/^1 kB · kliknite alebo presuňte sem iný súbor$/)).toBeInTheDocument()
		expect(within(dialog).getByRole('button', { name: 'Pokračovať na kontrolu' })).toBeEnabled()
	})

	it('rejects a file without the .csv extension locally', async () => {
		const requests = mockPage()
		renderApp(PAGE_PATH)
		const dialog = await openModal()

		chooseFile(dialog, csvFile('preklady.xlsx'))

		expect(await within(dialog).findByRole('alert')).toHaveTextContent('Podporovaný je iba súbor CSV (prípona .csv).')
		expect(within(dialog).getByLabelText('Súbor s prekladmi')).toHaveAttribute('aria-invalid', 'true')
		expect(within(dialog).getByRole('button', { name: 'Pokračovať na kontrolu' })).toBeDisabled()
		expect(sent(requests, 'post', PREVIEW_URL)).toHaveLength(0)
	})

	it('rejects a file over 10 MB locally', async () => {
		const requests = mockPage()
		renderApp(PAGE_PATH)
		const dialog = await openModal()

		const file = csvFile()
		Object.defineProperty(file, 'size', { value: IMPORT_FILE_MAX_BYTES + 1 })
		chooseFile(dialog, file)

		expect(await within(dialog).findByRole('alert')).toHaveTextContent('Súbor je príliš veľký. Maximálna veľkosť je 10 MB.')
		expect(within(dialog).getByRole('button', { name: 'Pokračovať na kontrolu' })).toBeDisabled()
		expect(sent(requests, 'post', PREVIEW_URL)).toHaveLength(0)
	})

	it('shows the read error when the FileReader fails', async () => {
		const requests = mockPage()
		vi.spyOn(FileReader.prototype, 'readAsText').mockImplementation(function (this: FileReader) {
			this.dispatchEvent(new Event('error'))
		})
		renderApp(PAGE_PATH)
		const dialog = await openModal()

		chooseFile(dialog, csvFile())

		expect(await within(dialog).findByRole('alert')).toHaveTextContent('Súbor sa nepodarilo prečítať. Skúste to znova.')
		expect(within(dialog).getByRole('button', { name: 'Pokračovať na kontrolu' })).toBeDisabled()
		expect(sent(requests, 'post', PREVIEW_URL)).toHaveLength(0)
	})

	it('rejects a file whose JSON body would exceed 12 MB locally', async () => {
		const requests = mockPage()
		renderApp(PAGE_PATH)
		const dialog = await openModal()

		// 7 MB of quotes is under the file limit but every quote escapes to two characters in JSON.
		chooseFile(dialog, csvFile('preklady.csv', '"'.repeat(7 * 1024 * 1024)))

		expect(await within(dialog).findByRole('alert', {}, { timeout: 5000 })).toHaveTextContent('Súbor je príliš veľký. Maximálna veľkosť je 10 MB.')
		expect(sent(requests, 'post', PREVIEW_URL)).toHaveLength(0)
	})

	it('lists the issues of a 422 with line numbers and „a ďalších N“, and lets the file be replaced', async () => {
		const requests = mockPage({
			[`POST ${PREVIEW_URL}`]: apiError(422, 'IMPORT_FILE_INVALID', {
				details: {
					issues: [
						{ code: 'ROW_COLUMN_COUNT', line: 812, params: { expected: 10, actual: 11 } },
						{ code: 'ROW_DUPLICATE_KEY', line: 20, column: 1, params: { key: 'Uložiť', namespace: 'common', firstLine: 4 } },
						{ code: 'FILE_EMPTY' },
					],
					total: 5,
				},
			}),
		})
		renderApp(PAGE_PATH)
		const dialog = await openModal()
		chooseFile(dialog, csvFile())
		await within(dialog).findByText('preklady.csv')
		fireEvent.click(within(dialog).getByRole('button', { name: 'Pokračovať na kontrolu' }))

		const alert = await within(dialog).findByRole('alert')
		expect(alert).toHaveTextContent('Súbor obsahuje chyby. Opravte ich a nahrajte ho znova.')
		const items = within(alert)
			.getAllByRole('listitem')
			.map((item) => item.textContent)
		expect(items).toEqual([
			'Riadok 812: očakávaných 10 stĺpcov, nájdených 11',
			'Riadok 20, stĺpec 1: kľúč „Uložiť“ je v namespace „common“ druhýkrát (prvýkrát na riadku 4)',
			'Súbor je prázdny alebo obsahuje iba hlavičku.',
		])
		expect(within(alert).getByText('a ďalšie 2')).toBeInTheDocument()
		expect(bodyOf(sent(requests, 'post', PREVIEW_URL)[0])).toEqual({ fileName: 'preklady.csv', content: CSV })

		chooseFile(dialog, csvFile('opravene.csv'))
		expect(await within(dialog).findByText('opravene.csv')).toBeInTheDocument()
		expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
	})

	it('shows the translated code of a 413', async () => {
		mockPage({ [`POST ${PREVIEW_URL}`]: apiError(413, 'IMPORT_FILE_TOO_LARGE') })
		renderApp(PAGE_PATH)
		const dialog = await openModal()
		chooseFile(dialog, csvFile())
		await within(dialog).findByText('preklady.csv')
		fireEvent.click(within(dialog).getByRole('button', { name: 'Pokračovať na kontrolu' }))

		expect(await within(dialog).findByRole('alert')).toHaveTextContent('Súbor je príliš veľký. Maximálna veľkosť je 10 MB.')
	})
})

describe('ImportModal step 2 (review)', () => {
	it('renders the columns with the language preselected by tag, the counts, the warnings and the summary', async () => {
		mockPage()
		renderApp(PAGE_PATH)
		const dialog = await goToReview()

		expect(within(dialog).getByRole('heading', { level: 3, name: 'Krok 2 z 2 · Kontrola' })).toHaveFocus()
		const table = within(dialog).getByRole('table', { name: 'Stĺpce jazykov v súbore' })
		expect(
			within(table)
				.getAllByRole('columnheader')
				.map((header) => header.textContent),
		).toEqual(['Jazyk', 'Stĺpec', 'Preklady', 'Nepreložené', 'Upozornenia', 'Nové / zmenené'])
		expect(languageSelect(dialog, 'sk')).toHaveValue('Slovak (sk)')
		expect(languageSelect(dialog, 'ru')).toHaveValue('')

		const skRow = languageSelect(dialog, 'sk').closest('tr')!
		expect(within(skRow).getByText('stĺpec 2')).toBeInTheDocument()
		expect(
			within(skRow)
				.getAllByRole('cell')
				.slice(2)
				.map((cell) => cell.textContent),
		).toEqual(['5', '1', '1', '3 / 1'])
		const ruRow = languageSelect(dialog, 'ru').closest('tr')!
		expect(within(ruRow).getByText('Jazyk ru nie je v projekte.')).toBeInTheDocument()
		expect(within(ruRow).getByRole('button', { name: 'Pridať jazyk ru' })).toBeInTheDocument()
		expect(within(ruRow).getByRole('button', { name: 'Preskočiť stĺpec ru' })).toBeInTheDocument()
		expect(within(ruRow).getByText('—')).toBeInTheDocument()

		const warnings = within(skRow).getByRole('button', { name: '1 upozornenie pre stĺpec sk' })
		expect(warnings).toHaveAttribute('aria-expanded', 'false')
		fireEvent.click(warnings)
		expect(warnings).toHaveAttribute('aria-expanded', 'true')
		expect(document.getElementById(warnings.getAttribute('aria-controls')!)).toHaveTextContent(
			'Riadok 6, stĺpec 2: kľúč „Nový kľúč“ (common) nemá preklad v základnom jazyku sk',
		)

		expect(summaryItems(dialog)).toEqual([
			'2 nové kľúče',
			'1 preklad sa prepíše',
			'3 nové preklady',
			'1 kľúč bez prekladu v základnom jazyku',
			'1 stĺpec sa preskočí',
		])
		expect(within(dialog).getByRole('button', { name: 'Importovať' })).toBeEnabled()
		expect(within(dialog).getByRole('button', { name: 'Späť' })).toBeInTheDocument()
	})

	it('adds the missing language and runs the preview again', async () => {
		let languages = [SLOVAK, ENGLISH]
		const requests = mockPage({
			[`GET ${LANGUAGES_URL}`]: () => ({ status: 200, data: languages }),
			[`POST ${PREVIEW_URL}`]: () => ({ status: 200, data: languages.includes(RUSSIAN) ? PREVIEW_WITH_RUSSIAN : PREVIEW }),
			[`POST ${LANGUAGES_URL}`]: () => {
				languages = [SLOVAK, ENGLISH, RUSSIAN]
				return { status: 201, data: RUSSIAN }
			},
		})
		renderApp(PAGE_PATH)
		const dialog = await goToReview()

		fireEvent.click(within(dialog).getByRole('button', { name: 'Pridať jazyk ru' }))

		await waitFor(() => expect(languageSelect(dialog, 'ru')).toHaveValue('Russian (ru)'))
		expect(bodyOf(sent(requests, 'post', LANGUAGES_URL)[0])).toEqual({ tag: 'ru' })
		expect(sent(requests, 'post', PREVIEW_URL)).toHaveLength(2)
		expect(within(dialog).queryByText('Jazyk ru nie je v projekte.')).not.toBeInTheDocument()
		const ruRow = languageSelect(dialog, 'ru').closest('tr')!
		expect(within(ruRow).getByText('2 / 0')).toBeInTheDocument()
		expect(summaryItems(dialog)).toEqual(['2 nové kľúče', '1 preklad sa prepíše', '5 nových prekladov', '1 kľúč bez prekladu v základnom jazyku'])
	})

	it('keeps a manual choice on a matched column when Pridať jazyk runs the preview again', async () => {
		let languages = [SLOVAK, ENGLISH]
		mockPage({
			[`GET ${LANGUAGES_URL}`]: () => ({ status: 200, data: languages }),
			[`POST ${PREVIEW_URL}`]: () => ({ status: 200, data: languages.includes(RUSSIAN) ? PREVIEW_WITH_RUSSIAN : PREVIEW }),
			[`POST ${LANGUAGES_URL}`]: () => {
				languages = [SLOVAK, ENGLISH, RUSSIAN]
				return { status: 201, data: RUSSIAN }
			},
		})
		renderApp(PAGE_PATH)
		const dialog = await goToReview()
		await pickOption(languageSelect(dialog, 'sk'), 'Preskočiť')

		fireEvent.click(within(dialog).getByRole('button', { name: 'Pridať jazyk ru' }))

		await waitFor(() => expect(languageSelect(dialog, 'ru')).toHaveValue('Russian (ru)'))
		expect(languageSelect(dialog, 'sk')).toHaveValue('Preskočiť')
		expect(summaryItems(dialog)).toContain('1 stĺpec sa preskočí')
	})

	it('still runs the preview again when Pridať jazyk answers LANGUAGE_TAKEN', async () => {
		let previews = 0
		const requests = mockPage(
			{
				[`POST ${PREVIEW_URL}`]: () => ({ status: 200, data: previews++ === 0 ? PREVIEW : PREVIEW_WITH_RUSSIAN }),
				[`POST ${LANGUAGES_URL}`]: apiError(409, 'LANGUAGE_TAKEN'),
			},
			[SLOVAK, ENGLISH, RUSSIAN],
		)
		renderApp(PAGE_PATH)
		const dialog = await goToReview()

		fireEvent.click(within(dialog).getByRole('button', { name: 'Pridať jazyk ru' }))

		await waitFor(() => expect(languageSelect(dialog, 'ru')).toHaveValue('Russian (ru)'))
		expect(sent(requests, 'post', PREVIEW_URL)).toHaveLength(2)
		expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
	})

	it('shows a non-422 preview error under the summary in the review step', async () => {
		let previews = 0
		mockPage({
			[`POST ${PREVIEW_URL}`]: () => (previews++ === 0 ? { status: 200, data: PREVIEW } : apiError(500, 'INTERNAL_ERROR')),
			[`POST ${LANGUAGES_URL}`]: { status: 201, data: RUSSIAN },
		})
		renderApp(PAGE_PATH)
		const dialog = await goToReview()

		fireEvent.click(within(dialog).getByRole('button', { name: 'Pridať jazyk ru' }))

		expect(await within(dialog).findByRole('alert')).toHaveTextContent('Nastala neočakávaná chyba. Skúste to znova.')
		expect(within(dialog).getByText('Krok 2 z 2 · Kontrola')).toBeInTheDocument()
		expect(within(dialog).getByRole('table', { name: 'Stĺpce jazykov v súbore' })).toBeInTheDocument()
	})

	it('shows the unknown-language text without Pridať jazyk for an UNKNOWN column', async () => {
		mockPage({
			[`POST ${PREVIEW_URL}`]: {
				status: 200,
				data: {
					...PREVIEW,
					columns: [PREVIEW.columns[0]!, { tag: 'xx', columnIndex: 3, match: 'UNKNOWN', stats: { translations: 2, untranslated: 4, warnings: 0 } }],
				},
			},
		})
		renderApp(PAGE_PATH)
		const dialog = await goToReview()

		const row = languageSelect(dialog, 'xx').closest('tr')!
		expect(within(row).getByText('Jazyk xx nie je v katalógu. Priraďte stĺpec jazyku projektu alebo ho preskočte.')).toBeInTheDocument()
		expect(within(row).queryByRole('button', { name: /Pridať jazyk/ })).not.toBeInTheDocument()
		expect(within(row).getByRole('button', { name: 'Preskočiť stĺpec xx' })).toBeInTheDocument()
	})

	it('skips a column and keeps Importovať disabled while every column is skipped', async () => {
		mockPage()
		renderApp(PAGE_PATH)
		const dialog = await goToReview()

		fireEvent.click(within(dialog).getByRole('button', { name: 'Preskočiť stĺpec ru' }))
		expect(languageSelect(dialog, 'ru')).toHaveValue('Preskočiť')
		expect(within(dialog).queryByText('Jazyk ru nie je v projekte.')).not.toBeInTheDocument()
		expect(within(dialog).getByRole('button', { name: 'Importovať' })).toBeEnabled()

		expect(summaryItems(dialog)).toContain('1 stĺpec sa preskočí')

		await pickOption(languageSelect(dialog, 'sk'), 'Preskočiť')
		const submit = within(dialog).getByRole('button', { name: 'Importovať' })
		expect(submit).toBeDisabled()
		expect(submit).toHaveAccessibleDescription('Priraďte aspoň jeden stĺpec jazyku projektu.')
		expect(summaryItems(dialog)).toEqual([
			'2 nové kľúče',
			'0 prekladov sa prepíše',
			'0 nových prekladov',
			'1 kľúč bez prekladu v základnom jazyku',
			'2 stĺpce sa preskočia',
		])
	})

	it('forgets the column choices and the preview when another file is chosen after a 422 on import', async () => {
		mockPage({
			[`POST ${IMPORT_URL}`]: apiError(422, 'IMPORT_FILE_INVALID', { details: { issues: [{ code: 'ROW_EMPTY_KEY', line: 3, column: 1 }], total: 1 } }),
		})
		renderApp(PAGE_PATH)
		const dialog = await goToReview()
		fireEvent.click(within(dialog).getByRole('button', { name: 'Preskočiť stĺpec ru' }))
		fireEvent.click(within(dialog).getByRole('button', { name: 'Importovať' }))
		await within(dialog).findByText('Riadok 3, stĺpec 1: prázdny kľúč')

		chooseFile(dialog, csvFile('opravene.csv'))
		await within(dialog).findByText('opravene.csv')
		fireEvent.click(within(dialog).getByRole('button', { name: 'Pokračovať na kontrolu' }))

		await within(dialog).findByRole('table', { name: 'Stĺpce jazykov v súbore' })
		expect(languageSelect(dialog, 'ru')).toHaveValue('')
		expect(within(dialog).getByText('Jazyk ru nie je v projekte.')).toBeInTheDocument()
	})

	it('marks the counts as approximate when a column is mapped by hand', async () => {
		mockPage()
		renderApp(PAGE_PATH)
		const dialog = await goToReview()

		fireEvent.click(languageSelect(dialog, 'ru'))
		fireEvent.click(await screen.findByRole('option', { name: 'English (en)' }))

		expect(languageSelect(dialog, 'ru')).toHaveValue('English (en)')
		expect(within(dialog).getByText('Počty sú približné: ručne priradené stĺpce sa do nich nepočítajú.')).toBeInTheDocument()
		fireEvent.click(languageSelect(dialog, 'sk'))
		expect(await screen.findByRole('option', { name: 'English (en)' })).toHaveAttribute('data-combobox-disabled', 'true')
	})

	it('sends the columns and createMissingKeys, shows the result and closes', async () => {
		const show = vi.spyOn(notifications, 'show')
		const requests = mockPage({
			[`POST ${IMPORT_URL}`]: { status: 200, data: { keysCreated: 2, translationsCreated: 3, translationsUpdated: 1, skippedColumns: 1 } },
		})
		renderApp(PAGE_PATH)
		const dialog = await openModal()
		chooseFile(dialog, csvFile())
		await within(dialog).findByText('preklady.csv')
		fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Vytvoriť chýbajúce kľúče' }))
		fireEvent.click(within(dialog).getByRole('button', { name: 'Pokračovať na kontrolu' }))
		await within(dialog).findByRole('table', { name: 'Stĺpce jazykov v súbore' })
		expect(within(dialog).getByText('2 nové kľúče sa nevytvoria (vypnuté Vytvoriť chýbajúce kľúče)')).toBeInTheDocument()
		const translationRequestsBefore = sent(requests, 'get', TRANSLATIONS_URL).length

		fireEvent.click(within(dialog).getByRole('button', { name: 'Importovať' }))

		await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Importovať preklady' })).not.toBeInTheDocument())
		expect(bodyOf(sent(requests, 'post', IMPORT_URL)[0])).toEqual({
			fileName: 'preklady.csv',
			content: CSV,
			columns: [
				{ columnIndex: 2, languageId: SLOVAK.id },
				{ columnIndex: 3, languageId: null },
			],
			createMissingKeys: false,
		})
		expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'green', message: 'Import dokončený: 2 nové kľúče, 3 nové preklady, 1 prepísaný.' }))
		await waitFor(() => expect(sent(requests, 'get', TRANSLATIONS_URL).length).toBeGreaterThan(translationRequestsBefore))

		// The next opening starts from scratch.
		fireEvent.click(screen.getByRole('button', { name: 'Importovať' }))
		const reopened = await screen.findByRole('dialog', { name: 'Importovať preklady' })
		expect(within(reopened).getByText('Krok 1 z 2 · Nahratie')).toBeInTheDocument()
		expect(within(reopened).getByRole('checkbox', { name: 'Vytvoriť chýbajúce kľúče' })).toBeChecked()
	})

	it('shows IMPORT_COLUMNS_INVALID in the modal and keeps it open', async () => {
		const show = vi.spyOn(notifications, 'show')
		mockPage({ [`POST ${IMPORT_URL}`]: apiError(400, 'IMPORT_COLUMNS_INVALID') })
		renderApp(PAGE_PATH)
		const dialog = await goToReview()

		fireEvent.click(within(dialog).getByRole('button', { name: 'Importovať' }))

		expect(await within(dialog).findByRole('alert')).toHaveTextContent('Priradenie stĺpcov k jazykom je neplatné. Skontrolujte jazyky a skúste to znova.')
		expect(screen.getByRole('dialog', { name: 'Importovať preklady' })).toBeInTheDocument()
		expect(within(dialog).getByRole('button', { name: 'Importovať' })).toBeEnabled()
		expect(show).not.toHaveBeenCalled()
	})

	it('goes back to the upload step with the issues when the import answers 422', async () => {
		mockPage({
			[`POST ${IMPORT_URL}`]: apiError(422, 'IMPORT_FILE_INVALID', { details: { issues: [{ code: 'ROW_EMPTY_KEY', line: 3, column: 1 }], total: 1 } }),
		})
		renderApp(PAGE_PATH)
		const dialog = await goToReview()

		fireEvent.click(within(dialog).getByRole('button', { name: 'Importovať' }))

		expect(await within(dialog).findByText('Riadok 3, stĺpec 1: prázdny kľúč')).toBeInTheDocument()
		expect(within(dialog).getByText('Krok 1 z 2 · Nahratie')).toBeInTheDocument()
	})

	it('Späť returns to the upload step with the file kept', async () => {
		mockPage()
		renderApp(PAGE_PATH)
		const dialog = await goToReview()

		fireEvent.click(within(dialog).getByRole('button', { name: 'Späť' }))

		expect(within(dialog).getByRole('heading', { level: 3, name: 'Krok 1 z 2 · Nahratie' })).toHaveFocus()
		expect(within(dialog).getByText('preklady.csv')).toBeInTheDocument()
		expect(within(dialog).getByRole('button', { name: 'Pokračovať na kontrolu' })).toBeEnabled()
	})
})
