import { notifications } from '@mantine/notifications'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { type InternalAxiosRequestConfig } from 'axios'
import { beforeAll, describe, expect, it, vi } from 'vite-plus/test'

import {
	type AuthUser,
	type Language,
	type ProjectSettings,
	SUPPORTED_LANGUAGES,
	type TranslationListItem,
	translationGroup,
	type TranslationsResponse,
	type UpdateTranslationKeyResponse,
} from '@locale/shared'

import queryClient from '@/api/queryClient'
import { QUERY_KEYS } from '@/api/queryKeys'
import { ADMIN_USER, apiError, EDITOR_USER, projectListRoute, signedInAs } from '@/test/mockApi'
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

const PROJECT: ProjectSettings = {
	id: '00000000-0000-4000-8000-000000000301',
	name: 'Booking Web',
	slug: 'booking-web',
	primaryColor: '#E83E8C',
	protectVariables: true,
	baseLanguageId: SLOVAK.id,
}

const PAGE_PATH = `/projects/${PROJECT.slug}/translations`
const TRANSLATIONS_URL = `/projects/${PROJECT.id}/translations`

const item = (name: string, overrides: Partial<TranslationListItem> = {}): TranslationListItem => ({
	keyId: `00000000-0000-4000-8000-0000000009${name.length.toString().padStart(2, '0')}`,
	namespace: 'loc',
	name,
	group: translationGroup('loc', name),
	description: null,
	plural: null,
	status: 'TRANSLATED',
	translations: {
		[SLOVAK.id]: { value: 'Vitajte', status: 'TRANSLATED', updatedAt: null, updatedBy: null },
		[ENGLISH.id]: { value: 'Welcome', status: 'TRANSLATED', updatedAt: null, updatedBy: null },
	},
	...overrides,
})

const WELCOME = item('dashboard.welcome', { description: 'Greeting on the dashboard' })

const COUNT = item('items.count', {
	plural: { variable: 'n' },
	translations: {
		[SLOVAK.id]: {
			value: '{n, plural, one {# položka} few {# položky} many {# položiek} other {# položiek}}',
			status: 'TRANSLATED',
			updatedAt: null,
			updatedBy: null,
		},
		[ENGLISH.id]: { value: '{n, plural, one {# item} other {# items}}', status: 'TRANSLATED', updatedAt: null, updatedBy: null },
	},
})

const patchUrl = (keyId: string) => `/projects/${PROJECT.id}/keys/${keyId}`

type MockResponse = { status: number; data?: unknown }

const mockPage = ({ user = ADMIN_USER, items = [WELCOME, COUNT], patch }: { user?: AuthUser; items?: TranslationListItem[]; patch?: MockResponse } = {}) => {
	const translations: TranslationsResponse = {
		items,
		total: items.length,
		page: 1,
		pageSize: 20,
		stats: { totalKeys: items.length, translated: items.length, untranslated: 0 },
		namespaces: ['loc'],
		editors: [],
	}
	const requests = signedInAs(user, {
		...projectListRoute(PROJECT),
		[`GET /projects/${PROJECT.id}/settings`]: { status: 200, data: PROJECT },
		[`GET /projects/${PROJECT.id}/languages`]: { status: 200, data: [SLOVAK, ENGLISH] },
		[`GET ${TRANSLATIONS_URL}`]: { status: 200, data: translations },
		...Object.fromEntries(
			items.map((entry) => [
				`PATCH ${patchUrl(entry.keyId)}`,
				(config: InternalAxiosRequestConfig) => {
					if (patch) {
						return patch
					}
					const body = JSON.parse(config.data as string) as Partial<UpdateTranslationKeyResponse>
					const data: UpdateTranslationKeyResponse = {
						keyId: entry.keyId,
						namespace: entry.namespace,
						name: body.name ?? entry.name,
						group: entry.group,
						description: body.description === undefined ? entry.description : body.description,
						plural: body.plural === undefined ? entry.plural : body.plural,
					}
					return { status: 200, data }
				},
			]),
		),
	})
	return {
		patches: () => requests.filter((request) => request.method === 'patch'),
		lists: () => requests.filter((request) => request.url === TRANSLATIONS_URL),
	}
}

const body = (request: InternalAxiosRequestConfig | undefined) => JSON.parse(request?.data as string) as unknown

const openModal = async (key: string) => {
	await screen.findByText(key)
	fireEvent.click(screen.getByRole('button', { name: `Upraviť kľúč ${key}` }))
	return screen.findByRole('dialog', { name: 'Upraviť kľúč' })
}

const submit = (dialog: HTMLElement) => fireEvent.click(within(dialog).getByRole('button', { name: 'Uložiť' }))

beforeAll(() => {
	queryClient.setQueryDefaults(QUERY_KEYS.PROJECTS.DETAIL(PROJECT.id), { retry: false })
})

describe('EditKeyModal', () => {
	it('shows the edit button and the description only to an admin', async () => {
		mockPage()
		renderApp(PAGE_PATH)
		await screen.findByText('dashboard.welcome')
		const edit = screen.getByRole('button', { name: 'Upraviť kľúč dashboard.welcome' })
		expect(screen.getByText('Greeting on the dashboard')).toBeInTheDocument()

		// Keyboard users see the tooltip too.
		fireEvent.focus(edit)
		expect(await screen.findByRole('tooltip')).toHaveTextContent('Upraviť kľúč')
	})

	it('hides the edit button from a member', async () => {
		mockPage({ user: EDITOR_USER })
		renderApp(PAGE_PATH)
		await screen.findByText('dashboard.welcome')
		expect(screen.queryByRole('button', { name: /Upraviť kľúč/ })).not.toBeInTheDocument()
		expect(screen.getByText('Greeting on the dashboard')).toBeInTheDocument()
	})

	it('opens with the key, the description and the plural setting of the key', async () => {
		mockPage()
		renderApp(PAGE_PATH)
		const dialog = await openModal('items.count')

		expect(within(dialog).getByLabelText(/Kľúč/)).toHaveValue('items.count')
		expect(within(dialog).getByLabelText(/Kľúč/)).toHaveFocus()
		expect(within(dialog).getByLabelText('Popis')).toHaveValue('')
		expect(within(dialog).getByLabelText('Popis')).toHaveAttribute('maxLength', '500')
		expect(within(dialog).getByRole('checkbox', { name: 'Použiť plurálové formy' })).toBeChecked()
		expect(within(dialog).getByText('Zapnutie presunie aktuálny text do formy Other, vypnutie ponechá text formy Other.')).toBeInTheDocument()
		expect(within(dialog).getByLabelText('Názov premennej')).toHaveValue('n')
	})

	it('renames the key with only the name in the request, notifies and refetches the list', async () => {
		const show = vi.spyOn(notifications, 'show')
		const { patches, lists } = mockPage()
		renderApp(PAGE_PATH)
		const dialog = await openModal('dashboard.welcome')
		const listsBefore = lists().length

		fireEvent.change(within(dialog).getByLabelText(/Kľúč/), { target: { value: ' dashboard.greeting ' } })
		submit(dialog)

		await waitFor(() => expect(patches()).toHaveLength(1))
		expect(patches()[0]?.url).toBe(patchUrl(WELCOME.keyId))
		expect(body(patches()[0])).toEqual({ name: 'dashboard.greeting' })
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
		expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'green', message: 'Kľúč dashboard.greeting bol uložený.' }))
		expect(lists().length).toBeGreaterThan(listsBefore)
	})

	it('sends the description, or null when it was cleared', async () => {
		const { patches } = mockPage()
		renderApp(PAGE_PATH)
		let dialog = await openModal('dashboard.welcome')
		fireEvent.change(within(dialog).getByLabelText('Popis'), { target: { value: '' } })
		submit(dialog)
		await waitFor(() => expect(patches()).toHaveLength(1))
		expect(body(patches()[0])).toEqual({ description: null })
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

		dialog = await openModal('items.count')
		fireEvent.change(within(dialog).getByLabelText('Popis'), { target: { value: 'Number of items in the cart' } })
		submit(dialog)
		await waitFor(() => expect(patches()).toHaveLength(2))
		expect(body(patches()[1])).toEqual({ description: 'Number of items in the cart' })
	})

	it('turns plural forms on with the variable', async () => {
		const { patches } = mockPage()
		renderApp(PAGE_PATH)
		const dialog = await openModal('dashboard.welcome')
		expect(within(dialog).queryByLabelText('Názov premennej')).not.toBeInTheDocument()

		fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Použiť plurálové formy' }))
		expect(within(dialog).getByLabelText('Názov premennej')).toHaveValue('count')
		fireEvent.change(within(dialog).getByLabelText('Názov premennej'), { target: { value: 'total' } })
		submit(dialog)

		await waitFor(() => expect(patches()).toHaveLength(1))
		expect(body(patches()[0])).toEqual({ plural: { variable: 'total' } })
	})

	it('prefills plural on with the detected variable when the translations are plural messages of a non-plural key', async () => {
		const detected = item('passes.loaded', {
			translations: {
				[SLOVAK.id]: {
					value: '{total, plural, one {# ďalšia} few {# ďalšie} other {# ďalších}}',
					status: 'TRANSLATED',
					updatedAt: null,
					updatedBy: null,
				},
				[ENGLISH.id]: { value: '{total, plural, one {# more} other {# more}}', status: 'TRANSLATED', updatedAt: null, updatedBy: null },
			},
		})
		const { patches } = mockPage({ items: [WELCOME, detected] })
		renderApp(PAGE_PATH)
		const dialog = await openModal('passes.loaded')

		const checkbox = within(dialog).getByRole('checkbox', { name: 'Použiť plurálové formy' })
		expect(checkbox).toBeChecked()
		expect(checkbox).toHaveAccessibleDescription('Preklady už sú plurálové správy s premennou total, preto je plurál predvyplnený. Zapne sa po uložení.')
		expect(within(dialog).getByLabelText('Názov premennej')).toHaveValue('total')
		submit(dialog)

		await waitFor(() => expect(patches()).toHaveLength(1))
		expect(body(patches()[0])).toEqual({ plural: { variable: 'total' } })
	})

	it('turns plural forms off with null', async () => {
		const { patches } = mockPage()
		renderApp(PAGE_PATH)
		const dialog = await openModal('items.count')

		fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Použiť plurálové formy' }))
		expect(within(dialog).queryByLabelText('Názov premennej')).not.toBeInTheDocument()
		submit(dialog)

		await waitFor(() => expect(patches()).toHaveLength(1))
		expect(body(patches()[0])).toEqual({ plural: null })
	})

	it('validates the key and the variable on the client without a request', async () => {
		const { patches } = mockPage()
		renderApp(PAGE_PATH)
		const dialog = await openModal('items.count')

		fireEvent.change(within(dialog).getByLabelText(/Kľúč/), { target: { value: '   ' } })
		fireEvent.change(within(dialog).getByLabelText('Názov premennej'), { target: { value: '1st' } })
		submit(dialog)

		expect(await within(dialog).findByText('Toto pole je povinné.')).toBeInTheDocument()
		expect(within(dialog).getByText('Neplatná hodnota.')).toBeInTheDocument()
		expect(within(dialog).getByLabelText('Názov premennej')).toHaveAttribute('aria-invalid', 'true')
		expect(patches()).toHaveLength(0)
	})

	it('closes without a request when nothing changed', async () => {
		const { patches } = mockPage()
		renderApp(PAGE_PATH)
		const dialog = await openModal('items.count')
		submit(dialog)
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
		expect(patches()).toHaveLength(0)
	})

	it('shows 409 TRANSLATION_KEY_TAKEN under the key and keeps the modal open', async () => {
		mockPage({ patch: apiError(409, 'TRANSLATION_KEY_TAKEN') })
		renderApp(PAGE_PATH)
		const dialog = await openModal('dashboard.welcome')

		fireEvent.change(within(dialog).getByLabelText(/Kľúč/), { target: { value: 'items.count' } })
		submit(dialog)

		expect(await within(dialog).findByText('Kľúč s týmto názvom už v namespace existuje.')).toBeInTheDocument()
		expect(within(dialog).getByLabelText(/Kľúč/)).toHaveAttribute('aria-invalid', 'true')
		expect(within(dialog).getByLabelText(/Kľúč/)).toHaveFocus()
		expect(screen.getByRole('dialog')).toBeInTheDocument()
		expect(screen.queryByText('English message that must not be shown')).not.toBeInTheDocument()
	})

	it('shows other errors as a notification', async () => {
		const show = vi.spyOn(notifications, 'show')
		mockPage({ patch: apiError(403, 'FORBIDDEN') })
		renderApp(PAGE_PATH)
		const dialog = await openModal('dashboard.welcome')

		fireEvent.change(within(dialog).getByLabelText(/Kľúč/), { target: { value: 'renamed' } })
		submit(dialog)

		await waitFor(() => expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'red', message: 'Na túto akciu nemáte oprávnenie.' })))
		expect(screen.getByRole('dialog')).toBeInTheDocument()
	})

	it('resets the form when reopened after cancel', async () => {
		mockPage()
		renderApp(PAGE_PATH)
		let dialog = await openModal('dashboard.welcome')
		fireEvent.change(within(dialog).getByLabelText(/Kľúč/), { target: { value: 'changed' } })
		fireEvent.click(within(dialog).getByRole('button', { name: 'Zrušiť' }))
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

		dialog = await openModal('dashboard.welcome')
		expect(within(dialog).getByLabelText(/Kľúč/)).toHaveValue('dashboard.welcome')
	})
})
