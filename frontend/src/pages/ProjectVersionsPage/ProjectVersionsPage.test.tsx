import { notifications } from '@mantine/notifications'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { type InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vite-plus/test'

import { type ProjectSettings, type ProjectVersion, VERSION_LOCK } from '@locale/shared'

import queryClient from '@/api/queryClient'
import { QUERY_KEYS } from '@/api/queryKeys'
import i18n from '@/lib/i18n'
import { ADMIN_USER, apiError, EDITOR_USER, projectListRoute, signedInAs } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'

const PROJECT: ProjectSettings = {
	id: '00000000-0000-4000-8000-000000000301',
	name: 'Booking Web',
	slug: 'booking-web',
	primaryColor: '#E83E8C',
	protectVariables: true,
	baseLanguageId: null,
}

const PAGE_PATH = `/projects/${PROJECT.slug}/versions`

const LIST_URL = `/projects/${PROJECT.id}/versions`

const PROJECT_ROUTES = {
	...projectListRoute(PROJECT),
	[`GET /projects/${PROJECT.id}/settings`]: { status: 200, data: PROJECT },
	[`GET /projects/${PROJECT.id}/languages`]: { status: 200, data: [] },
}

const version = (overrides: Partial<ProjectVersion> & Pick<ProjectVersion, 'id' | 'name'>): ProjectVersion => ({
	startsAt: '2026-09-08',
	endsAt: '2026-09-29',
	lock: VERSION_LOCK.AUTO,
	isLocked: false,
	state: 'ACTIVE',
	isCurrent: false,
	importedAt: null,
	keyCount: 0,
	createdAt: '2026-09-01T10:00:00.000Z',
	createdBy: { id: ADMIN_USER.id, name: 'Michal Bella' },
	...overrides,
})

const LOCKED = version({
	id: '00000000-0000-4000-8000-000000000501',
	name: 'v2.44',
	startsAt: '2026-08-11',
	endsAt: '2026-09-01',
	isLocked: true,
	state: 'LOCKED',
})
const CURRENT = version({ id: '00000000-0000-4000-8000-000000000502', name: 'v2.45', isCurrent: true, createdBy: null })
const UPCOMING = version({
	id: '00000000-0000-4000-8000-000000000503',
	name: 'v2.46',
	startsAt: '2026-10-06',
	endsAt: '2026-10-27',
	lock: VERSION_LOCK.LOCKED,
	isLocked: true,
	state: 'LOCKED',
})

const versionsResponse = (items: ProjectVersion[]) => ({ status: 200, data: { items } })

const getTable = () => screen.getByRole('table', { name: 'Zoznam verzií' })

const findRow = async (name: string) => {
	const row = (await within(await screen.findByRole('table', { name: 'Zoznam verzií' })).findByText(name)).closest('tr')
	if (!row) {
		throw new Error(`Row ${name} not found`)
	}
	return row
}

const bodyOf = (request: InternalAxiosRequestConfig | undefined) => JSON.parse(request?.data as string) as unknown

const openCreateModal = async () => {
	fireEvent.click(await screen.findByRole('button', { name: 'Vytvoriť verziu' }))
	return screen.findByRole('dialog', { name: 'Vytvoriť verziu' })
}

const fillForm = (dialog: HTMLElement, values: { name?: string; startsAt?: string; endsAt?: string }) => {
	if (values.name !== undefined) {
		fireEvent.change(within(dialog).getByLabelText('Názov verzie'), { target: { value: values.name } })
	}
	if (values.startsAt !== undefined) {
		fireEvent.change(within(dialog).getByLabelText('Začiatok'), { target: { value: values.startsAt } })
	}
	if (values.endsAt !== undefined) {
		fireEvent.change(within(dialog).getByLabelText('Koniec'), { target: { value: values.endsAt } })
	}
}

beforeAll(() => {
	queryClient.setQueryDefaults(QUERY_KEYS.PROJECTS.VERSIONS(PROJECT.id), { retry: false })
})

afterEach(() => {
	vi.restoreAllMocks()
	void i18n.changeLanguage('sk')
})

describe('ProjectVersionsPage table', () => {
	it('renders the rows with dates, states, the current badge and who created the version', async () => {
		signedInAs(ADMIN_USER, { ...PROJECT_ROUTES, [`GET ${LIST_URL}`]: versionsResponse([UPCOMING, CURRENT, LOCKED]) })
		renderApp(PAGE_PATH)

		const current = await findRow('v2.45')
		expect(screen.getByRole('heading', { level: 1, name: 'Verzie' })).toBeInTheDocument()
		expect(current).toHaveTextContent('Aktuálna')
		expect(current).toHaveTextContent('8. 9. 2026')
		expect(current).toHaveTextContent('29. 9. 2026')
		expect(current).toHaveTextContent('Prebieha')
		expect(current).toHaveTextContent('Vytvorená 1. 9. 2026')
		const locked = await findRow('v2.44')
		expect(locked).toHaveTextContent('Uzamknutá')
		expect(locked).toHaveTextContent('Vytvoril Michal Bella')
		expect(locked).not.toHaveTextContent('Zamknutá ručne')
		const upcoming = await findRow('v2.46')
		expect(upcoming).toHaveTextContent('Zamknutá ručne')
		expect(
			within(getTable())
				.getAllByRole('row')
				.slice(1)
				.map((row) => row.textContent?.slice(0, 5)),
		).toEqual(['v2.46', 'v2.45', 'v2.44'])
		expect(within(current).getByRole('button', { name: 'Upraviť verziu v2.45' })).toBeInTheDocument()
		expect(within(current).getByRole('button', { name: 'Zamknúť verziu v2.45' })).toBeInTheDocument()
		expect(within(locked).getByRole('button', { name: 'Odomknúť verziu v2.44' })).toBeInTheDocument()
	})

	it('hides the create button and the actions from an EDITOR, also in the empty state', async () => {
		signedInAs(EDITOR_USER, { ...PROJECT_ROUTES, [`GET ${LIST_URL}`]: versionsResponse([]) })
		renderApp(PAGE_PATH)

		expect(await screen.findByText('Projekt zatiaľ nemá žiadne verzie.')).toBeInTheDocument()
		expect(screen.queryByRole('button', { name: 'Vytvoriť verziu' })).not.toBeInTheDocument()
		expect(screen.queryByRole('columnheader', { name: 'Akcie' })).not.toBeInTheDocument()
	})

	it('shows the empty state with a button that opens the create modal', async () => {
		signedInAs(ADMIN_USER, { ...PROJECT_ROUTES, [`GET ${LIST_URL}`]: versionsResponse([]) })
		renderApp(PAGE_PATH)

		const table = await screen.findByRole('table', { name: 'Zoznam verzií' })
		expect(await within(table).findByText('Projekt zatiaľ nemá žiadne verzie. Vytvorte prvú alebo ju zadajte pri importe.')).toBeInTheDocument()
		fireEvent.click(within(table).getByRole('button', { name: 'Vytvoriť verziu' }))
		expect(await screen.findByRole('dialog', { name: 'Vytvoriť verziu' })).toBeInTheDocument()
	})

	it('shows the translated load error and retries', async () => {
		let failed = false
		signedInAs(ADMIN_USER, {
			...PROJECT_ROUTES,
			[`GET ${LIST_URL}`]: () => {
				if (failed) {
					return versionsResponse([CURRENT])
				}
				failed = true
				return apiError(500, 'INTERNAL_ERROR')
			},
		})
		renderApp(PAGE_PATH)

		expect(await screen.findByText('Zoznam verzií sa nepodarilo načítať.')).toBeInTheDocument()
		expect(screen.getByText('Nastala neočakávaná chyba. Skúste to znova.')).toBeInTheDocument()
		fireEvent.click(screen.getByRole('button', { name: 'Skúsiť znova' }))
		expect(await findRow('v2.45')).toBeInTheDocument()
	})

	it('renders dates and states in en', async () => {
		await i18n.changeLanguage('en')
		signedInAs(ADMIN_USER, { ...PROJECT_ROUTES, [`GET ${LIST_URL}`]: versionsResponse([CURRENT]) })
		renderApp(PAGE_PATH)

		const row = (await within(await screen.findByRole('table', { name: 'List of versions' })).findByText('v2.45')).closest('tr')
		expect(row).toHaveTextContent('08/09/2026')
		expect(row).toHaveTextContent('In progress')
		expect(row).toHaveTextContent('Current')
	})
})

describe('ProjectVersionsPage create', () => {
	it('validates the fields on the client before sending', async () => {
		const requests = signedInAs(ADMIN_USER, { ...PROJECT_ROUTES, [`GET ${LIST_URL}`]: versionsResponse([]) })
		renderApp(PAGE_PATH)
		const dialog = await openCreateModal()

		fireEvent.click(within(dialog).getByRole('button', { name: 'Vytvoriť' }))
		expect(await within(dialog).findAllByText('Toto pole je povinné.')).toHaveLength(3)

		fillForm(dialog, { name: 'v2.47', startsAt: '2026-11-03', endsAt: '2026-11-03' })
		fireEvent.click(within(dialog).getByRole('button', { name: 'Vytvoriť' }))
		expect(await within(dialog).findByText('Koniec musí byť po začiatku.')).toBeInTheDocument()
		expect(requests.filter((request) => request.method === 'post')).toHaveLength(0)
	})

	it('posts the version, shows the notification, closes and refetches the list', async () => {
		let items: ProjectVersion[] = []
		const requests = signedInAs(ADMIN_USER, {
			...PROJECT_ROUTES,
			[`GET ${LIST_URL}`]: () => versionsResponse(items),
			[`POST ${LIST_URL}`]: () => {
				items = [version({ id: '00000000-0000-4000-8000-000000000504', name: 'v2.47', startsAt: '2026-11-03', endsAt: '2026-11-24' })]
				return { status: 201, data: items[0] }
			},
		})
		const show = vi.spyOn(notifications, 'show')
		renderApp(PAGE_PATH)
		const dialog = await openCreateModal()

		fillForm(dialog, { name: ' v2.47 ', startsAt: '2026-11-03', endsAt: '2026-11-24' })
		fireEvent.click(within(dialog).getByRole('button', { name: 'Vytvoriť' }))

		expect(await findRow('v2.47')).toBeInTheDocument()
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
		expect(bodyOf(requests.find((request) => request.method === 'post'))).toEqual({ name: 'v2.47', startsAt: '2026-11-03', endsAt: '2026-11-24' })
		expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'green', message: 'Verzia v2.47 bola vytvorená.' }))
	})

	it('shows 409 PROJECT_VERSION_NAME_TAKEN and a 400 detail at the fields and keeps the modal open', async () => {
		let attempt = 0
		signedInAs(ADMIN_USER, {
			...PROJECT_ROUTES,
			[`GET ${LIST_URL}`]: versionsResponse([CURRENT]),
			[`POST ${LIST_URL}`]: () => {
				attempt += 1
				return attempt === 1
					? apiError(409, 'PROJECT_VERSION_NAME_TAKEN')
					: apiError(400, 'VALIDATION_ERROR', { details: [{ path: 'endsAt', code: 'INVALID' }] })
			},
		})
		renderApp(PAGE_PATH)
		const dialog = await openCreateModal()

		fillForm(dialog, { name: 'v2.45', startsAt: '2026-11-03', endsAt: '2026-11-24' })
		fireEvent.click(within(dialog).getByRole('button', { name: 'Vytvoriť' }))
		expect(await within(dialog).findByText('Verzia s týmto názvom už v projekte existuje.')).toBeInTheDocument()

		fillForm(dialog, { name: 'v2.48' })
		fireEvent.click(within(dialog).getByRole('button', { name: 'Vytvoriť' }))
		expect(await within(dialog).findByText('Koniec musí byť po začiatku.')).toBeInTheDocument()
		expect(screen.getByRole('dialog', { name: 'Vytvoriť verziu' })).toBeInTheDocument()
	})
})

describe('ProjectVersionsPage edit and lock', () => {
	it('opens the edit modal with the values and patches every field', async () => {
		let items = [CURRENT]
		const requests = signedInAs(ADMIN_USER, {
			...PROJECT_ROUTES,
			[`GET ${LIST_URL}`]: () => versionsResponse(items),
			[`PATCH ${LIST_URL}/${CURRENT.id}`]: () => {
				items = [{ ...CURRENT, name: 'v2.45.1', endsAt: '2026-10-02' }]
				return { status: 200, data: items[0] }
			},
		})
		const show = vi.spyOn(notifications, 'show')
		renderApp(PAGE_PATH)

		fireEvent.click(within(await findRow('v2.45')).getByRole('button', { name: 'Upraviť verziu v2.45' }))
		const dialog = await screen.findByRole('dialog', { name: 'Upraviť verziu' })
		expect(within(dialog).getByLabelText('Názov verzie')).toHaveValue('v2.45')
		expect(within(dialog).getByLabelText('Začiatok')).toHaveValue('8. 9. 2026')
		expect(within(dialog).getByLabelText('Koniec')).toHaveValue('29. 9. 2026')

		fillForm(dialog, { name: 'v2.45.1', endsAt: '2026-10-02' })
		fireEvent.click(within(dialog).getByRole('button', { name: 'Uložiť' }))

		expect(await findRow('v2.45.1')).toBeInTheDocument()
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
		expect(bodyOf(requests.find((request) => request.method === 'patch'))).toEqual({ name: 'v2.45.1', startsAt: '2026-09-08', endsAt: '2026-10-02' })
		expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'green', message: 'Verzia v2.45.1 bola uložená.' }))
	})

	it('locks after a confirmation and unlocks a locked version', async () => {
		let items = [CURRENT, LOCKED]
		const requests = signedInAs(ADMIN_USER, {
			...PROJECT_ROUTES,
			[`GET ${LIST_URL}`]: () => versionsResponse(items),
			[`PATCH ${LIST_URL}/${CURRENT.id}`]: () => {
				items = [{ ...CURRENT, lock: VERSION_LOCK.LOCKED, isLocked: true, state: 'LOCKED' }, LOCKED]
				return { status: 200, data: items[0] }
			},
			[`PATCH ${LIST_URL}/${LOCKED.id}`]: () => {
				items = [items[0] ?? CURRENT, { ...LOCKED, lock: VERSION_LOCK.UNLOCKED, isLocked: false, state: 'ACTIVE' }]
				return { status: 200, data: items[1] }
			},
		})
		const show = vi.spyOn(notifications, 'show')
		renderApp(PAGE_PATH)

		fireEvent.click(within(await findRow('v2.45')).getByRole('button', { name: 'Zamknúť verziu v2.45' }))
		const lockDialog = await screen.findByRole('dialog', { name: 'Zamknúť verziu' })
		expect(lockDialog).toHaveTextContent('Po zamknutí verzie v2.45 môže jej preklady upravovať už len administrátor.')
		fireEvent.click(within(lockDialog).getByRole('button', { name: 'Zamknúť' }))
		await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
		expect(await within(await findRow('v2.45')).findByRole('button', { name: 'Odomknúť verziu v2.45' })).toBeInTheDocument()
		expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'green', message: 'Verzia v2.45 je uzamknutá.' }))

		fireEvent.click(within(await findRow('v2.44')).getByRole('button', { name: 'Odomknúť verziu v2.44' }))
		const unlockDialog = await screen.findByRole('dialog', { name: 'Odomknúť verziu' })
		fireEvent.click(within(unlockDialog).getByRole('button', { name: 'Odomknúť' }))
		expect(await within(await findRow('v2.44')).findByText('Odomknutá na dodatočné úpravy')).toBeInTheDocument()
		expect(requests.filter((request) => request.method === 'patch').map(bodyOf)).toEqual([{ lock: 'LOCKED' }, { lock: 'UNLOCKED' }])
	})

	it('shows the translated error and keeps the confirmation open when locking fails', async () => {
		signedInAs(ADMIN_USER, {
			...PROJECT_ROUTES,
			[`GET ${LIST_URL}`]: versionsResponse([CURRENT]),
			[`PATCH ${LIST_URL}/${CURRENT.id}`]: apiError(500, 'INTERNAL_ERROR'),
		})
		const show = vi.spyOn(notifications, 'show')
		renderApp(PAGE_PATH)

		fireEvent.click(within(await findRow('v2.45')).getByRole('button', { name: 'Zamknúť verziu v2.45' }))
		const dialog = await screen.findByRole('dialog', { name: 'Zamknúť verziu' })
		fireEvent.click(within(dialog).getByRole('button', { name: 'Zamknúť' }))

		await waitFor(() =>
			expect(show).toHaveBeenCalledWith(expect.objectContaining({ color: 'red', message: 'Nastala neočakávaná chyba. Skúste to znova.' })),
		)
		expect(screen.getByRole('dialog', { name: 'Zamknúť verziu' })).toBeInTheDocument()
	})
})
