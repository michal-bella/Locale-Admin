import { notifications } from '@mantine/notifications'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { type InternalAxiosRequestConfig } from 'axios'
import { beforeAll, describe, expect, it, vi } from 'vite-plus/test'

import {
	type AuthUser,
	type CreateTranslationKeyRequest,
	type CreateTranslationKeyResponse,
	type Language,
	type ProjectSettings,
	SUPPORTED_LANGUAGES,
	translationGroup,
	type TranslationListItem,
	type TranslationsResponse,
} from '@locale/shared'

import queryClient from '@/api/queryClient'
import { QUERY_KEYS } from '@/api/queryKeys'
import { ADMIN_USER, apiError, CURRENT_VERSION, EDITOR_USER, projectListRoute, signedInAs } from '@/test/mockApi'
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
const KEYS_URL = `/projects/${PROJECT.id}/keys`

const WELCOME: TranslationListItem = {
	keyId: '00000000-0000-4000-8000-000000000901',
	namespace: 'loc',
	name: 'dashboard.welcome',
	group: translationGroup('loc', 'dashboard.welcome'),
	description: null,
	plural: null,
	status: 'TRANSLATED',
	translations: {
		[SLOVAK.id]: { value: 'Vitajte', status: 'TRANSLATED', updatedAt: null, updatedBy: null },
		[ENGLISH.id]: { value: 'Welcome', status: 'TRANSLATED', updatedAt: null, updatedBy: null },
	},
}

type MockResponse = { status: number; data?: unknown }

const mockPage = ({
	user = ADMIN_USER,
	namespaces = ['loc', 'paths'],
	languages = [SLOVAK, ENGLISH],
	post,
}: { user?: AuthUser; namespaces?: string[]; languages?: Language[]; post?: MockResponse } = {}) => {
	const items = namespaces.length > 0 ? [WELCOME] : []
	const translations: TranslationsResponse = {
		items,
		total: items.length,
		page: 1,
		pageSize: 20,
		stats: { totalKeys: items.length, translated: items.length, untranslated: 0, warnings: 0 },
		namespaces,
		editors: [],
	}
	const requests = signedInAs(user, {
		...projectListRoute(PROJECT),
		[`GET /projects/${PROJECT.id}/settings`]: { status: 200, data: PROJECT },
		[`GET /projects/${PROJECT.id}/languages`]: { status: 200, data: languages },
		[`GET /projects/${PROJECT.id}/versions`]: { status: 200, data: { items: [CURRENT_VERSION] } },
		[`GET ${TRANSLATIONS_URL}`]: { status: 200, data: translations },
		[`POST ${KEYS_URL}`]: (config: InternalAxiosRequestConfig) => {
			if (post) {
				return post
			}
			const body = JSON.parse(config.data as string) as CreateTranslationKeyRequest
			const data: CreateTranslationKeyResponse = {
				keyId: '00000000-0000-4000-8000-000000000999',
				namespace: body.namespace,
				name: body.name,
				group: translationGroup(body.namespace, body.name),
				description: null,
				plural: null,
			}
			return { status: 201, data }
		},
	})
	return {
		posts: () => requests.filter((request) => request.method === 'post' && request.url === KEYS_URL),
		lists: () => requests.filter((request) => request.url === TRANSLATIONS_URL),
	}
}

const body = (request: InternalAxiosRequestConfig | undefined) => JSON.parse(request?.data as string) as unknown

const openModal = async () => {
	fireEvent.click(await screen.findByRole('button', { name: 'Pridať kľúč' }))
	return screen.findByRole('dialog', { name: 'Pridať kľúč' })
}

const submit = (dialog: HTMLElement) => fireEvent.click(within(dialog).getByRole('button', { name: 'Pridať' }))

const chooseNamespace = async (dialog: HTMLElement, namespace: string) => {
	fireEvent.click(within(dialog).getByLabelText(/Namespace/, { selector: 'input' }))
	fireEvent.click(await screen.findByRole('option', { name: namespace }))
}

beforeAll(() => {
	queryClient.setQueryDefaults(QUERY_KEYS.PROJECTS.DETAIL(PROJECT.id), { retry: false })
})

describe('CreateKeyModal', () => {
	it('hides Pridať kľúč from a member', async () => {
		mockPage({ user: EDITOR_USER })
		renderApp(PAGE_PATH)
		await screen.findByText('dashboard.welcome')
		expect(screen.queryByRole('button', { name: 'Pridať kľúč' })).not.toBeInTheDocument()
	})

	it('hides Pridať kľúč from an admin of a project without keys', async () => {
		mockPage({ namespaces: [] })
		renderApp(PAGE_PATH)
		expect(await screen.findAllByRole('button', { name: 'Importovať' })).not.toHaveLength(0)
		expect(screen.queryByRole('button', { name: 'Pridať kľúč' })).not.toBeInTheDocument()
	})

	it('creates the key with the chosen namespace and filled values, notifies, refetches and shows the new key', async () => {
		const show = vi.spyOn(notifications, 'show')
		const { posts, lists } = mockPage()
		const router = renderApp(`${PAGE_PATH}?status=TRANSLATED&page=2`)
		const dialog = await openModal()
		const listsBefore = lists().length

		expect(within(dialog).getByLabelText(/Kľúč/)).toHaveFocus()
		fireEvent.change(within(dialog).getByLabelText(/Kľúč/), { target: { value: ' orders.empty.title ' } })
		await chooseNamespace(dialog, 'paths')
		fireEvent.change(within(dialog).getByLabelText(/slovenčina/i), { target: { value: 'Žiadne objednávky' } })
		submit(dialog)

		await waitFor(() => expect(posts()).toHaveLength(1))
		expect(body(posts()[0])).toEqual({
			name: 'orders.empty.title',
			namespace: 'paths',
			translations: { [SLOVAK.id]: 'Žiadne objednávky', [ENGLISH.id]: '' },
			versionId: CURRENT_VERSION.id,
		})
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
		expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'green', message: 'Kľúč orders.empty.title bol pridaný.' }))
		expect(lists().length).toBeGreaterThan(listsBefore)
		await waitFor(() => expect(router.state.location.search).toEqual({ search: 'orders.empty.title', namespace: 'paths' }))
	})

	it('preselects the namespace of the active filter', async () => {
		const { posts } = mockPage()
		renderApp(`${PAGE_PATH}?namespace=paths`)
		const dialog = await openModal()

		expect(within(dialog).getByLabelText(/Namespace/, { selector: 'input' })).toHaveValue('paths')
		fireEvent.change(within(dialog).getByLabelText(/Kľúč/), { target: { value: 'a' } })
		submit(dialog)
		await waitFor(() => expect(posts()).toHaveLength(1))
		expect(body(posts()[0])).toMatchObject({ namespace: 'paths' })
	})

	it('requires the key and a namespace on the client without a request', async () => {
		const { posts } = mockPage()
		renderApp(PAGE_PATH)
		const dialog = await openModal()

		submit(dialog)
		expect(await within(dialog).findByText('Toto pole je povinné.')).toBeInTheDocument()
		fireEvent.change(within(dialog).getByLabelText(/Kľúč/), { target: { value: 'a' } })
		submit(dialog)
		await waitFor(() => expect(within(dialog).getByLabelText(/Namespace/, { selector: 'input' })).toHaveAttribute('aria-invalid', 'true'))
		expect(posts()).toHaveLength(0)
	})

	it('shows 409 TRANSLATION_KEY_TAKEN under the key and keeps the modal open', async () => {
		mockPage({ namespaces: ['loc'], post: apiError(409, 'TRANSLATION_KEY_TAKEN') })
		renderApp(PAGE_PATH)
		const dialog = await openModal()

		fireEvent.change(within(dialog).getByLabelText(/Kľúč/), { target: { value: 'dashboard.welcome' } })
		submit(dialog)

		expect(await within(dialog).findByText('Kľúč s týmto názvom už v namespace existuje.')).toBeInTheDocument()
		expect(within(dialog).getByLabelText(/Kľúč/)).toHaveFocus()
		expect(screen.queryByText('English message that must not be shown')).not.toBeInTheDocument()
	})

	it('shows 400 PLACEHOLDER_MISMATCH under the language that differs', async () => {
		mockPage({
			namespaces: ['loc'],
			post: apiError(400, 'PLACEHOLDER_MISMATCH', { details: { missing: ['{{name}}'], extra: [], languageId: ENGLISH.id } }),
		})
		renderApp(PAGE_PATH)
		const dialog = await openModal()

		fireEvent.change(within(dialog).getByLabelText(/Kľúč/), { target: { value: 'greeting' } })
		fireEvent.change(within(dialog).getByLabelText(/slovenčina/i), { target: { value: 'Ahoj {{name}}' } })
		fireEvent.change(within(dialog).getByLabelText(/angličtina/i), { target: { value: 'Hello' } })
		submit(dialog)

		expect(await within(dialog).findByText('Premenné v preklade sa nezhodujú so základným jazykom. Chýbajú: {{name}}.')).toBeInTheDocument()
		expect(within(dialog).getByLabelText(/angličtina/i)).toHaveAttribute('aria-invalid', 'true')
	})

	it('puts the fields into two columns from five languages and keeps one column below', async () => {
		mockPage({ languages: [SLOVAK, ENGLISH, toLanguage('cs', 3), toLanguage('de-AT', 4), toLanguage('hu', 5)] })
		renderApp(PAGE_PATH)
		const dialog = await openModal()

		const grids = dialog.querySelectorAll('[data-columns="2"], [data-columns="1"]')
		expect(grids).toHaveLength(1)
		expect(grids[0]).toHaveAttribute('data-columns', '2')
		expect(grids[0]).toHaveClass('sm:grid-cols-2')
		for (const language of [/slovenčina/i, /čeština/i, /angličtina/i, /nemčina/i, /maďarčina/i]) {
			expect(within(dialog).getByLabelText(language)).toBeInTheDocument()
		}
		expect(dialog.closest('.mantine-Modal-root')?.getAttribute('style') ?? '').toContain('--modal-size: calc(45rem')
	})

	it('marks the base language with the Základný badge instead of a description', async () => {
		mockPage()
		renderApp(PAGE_PATH)
		const dialog = await openModal()

		const slovak = within(dialog).getByLabelText(/slovenčina/i)
		expect(within(slovak.closest('.mantine-InputWrapper-root') as HTMLElement).getByText('Základný')).toBeInTheDocument()
		expect(within(dialog).queryByText(/referenčný text/)).not.toBeInTheDocument()
		expect(
			within(
				within(dialog)
					.getByLabelText(/angličtina/i)
					.closest('.mantine-InputWrapper-root') as HTMLElement,
			).queryByText('Základný'),
		).toBeNull()
	})

	it('keeps one column with up to four languages', async () => {
		mockPage()
		renderApp(PAGE_PATH)
		const dialog = await openModal()

		expect(dialog.querySelector('[data-columns]')).toHaveAttribute('data-columns', '1')
		expect(dialog.querySelector('[data-columns]')).not.toHaveClass('sm:grid-cols-2')
	})

	it('resets the form when reopened after cancel', async () => {
		mockPage()
		renderApp(PAGE_PATH)
		let dialog = await openModal()
		fireEvent.change(within(dialog).getByLabelText(/Kľúč/), { target: { value: 'changed' } })
		fireEvent.click(within(dialog).getByRole('button', { name: 'Zrušiť' }))
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

		dialog = await openModal()
		expect(within(dialog).getByLabelText(/Kľúč/)).toHaveValue('')
	})
})
