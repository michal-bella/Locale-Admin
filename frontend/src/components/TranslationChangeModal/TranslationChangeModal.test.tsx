import { MantineProvider } from '@mantine/core'
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'

import { ACTIVITY_TYPE } from '@locale/shared'

import { mantineTheme } from '@/styles/mantineTheme'

import TranslationChangeModal from './TranslationChangeModal'
import { type TranslationChangeEvent } from './types'

const change = (languageTag: string, oldValue: string | null, newValue: string | null): TranslationChangeEvent => ({
	id: '00000000-0000-4000-8000-000000000901',
	createdAt: '2026-10-24T08:30:00.000Z',
	count: 1,
	user: { id: '00000000-0000-4000-8000-000000000201', name: 'Jana Nováková' },
	version: { id: '00000000-0000-4000-8000-000000000502', name: 'v2.45' },
	type: ACTIVITY_TYPE.TRANSLATION_UPDATED,
	payload: { keyId: '00000000-0000-4000-8000-000000000601', namespace: 'loc', name: 'orders.status', languageTag, oldValue, newValue },
})

// Otvoriť preklad is a router link, so the modal renders as the page of a one-route router.
const renderModal = async (event: TranslationChangeEvent) => {
	const rootRoute = createRootRoute({ component: () => <TranslationChangeModal opened event={event} projectSlug='booking-web' onClose={vi.fn()} /> })
	const router = createRouter({ routeTree: rootRoute, history: createMemoryHistory() })
	render(<RouterProvider router={router} />, { wrapper: ({ children }) => <MantineProvider theme={mantineTheme}>{children}</MantineProvider> })
	await screen.findByRole('dialog', { name: 'Zmena prekladu' })
}

const block = (title: string) => {
	const section = screen.getByRole('heading', { level: 3, name: title }).closest('section')
	if (!section) {
		throw new Error(`Block ${title} not found`)
	}
	return section
}

const marked = (section: HTMLElement, tag: 'del' | 'ins') => Array.from(section.querySelectorAll(tag)).map((element) => element.textContent)

describe('TranslationChangeModal', () => {
	it('shows who, when, the key and language, and marks the changed words', async () => {
		await renderModal(change('en', 'The order was sent yesterday', 'The order was delivered today'))

		const dialog = screen.getByRole('dialog', { name: 'Zmena prekladu' })
		expect(dialog.querySelector('header code')).toHaveTextContent('loc:orders.status')
		expect(within(dialog).getByText('Angličtina')).toBeInTheDocument()
		expect(within(dialog).getByText('v2.45')).toBeInTheDocument()
		expect(within(dialog).getByText('Jana Nováková')).toBeInTheDocument()
		const open = new URL(within(dialog).getByRole('link', { name: 'Otvoriť preklad' }).getAttribute('href') ?? '', 'http://localhost')
		expect(open.pathname).toBe('/projects/booking-web/translations')
		expect(open.searchParams.get('editKey')).toBe('00000000-0000-4000-8000-000000000601')
		expect(open.searchParams.get('editLanguage')).toBe('en')
		expect(open.searchParams.get('version')).toBe('00000000-0000-4000-8000-000000000502')

		const before = block('Pred')
		const after = block('Po')
		expect(before.querySelector('p')).toHaveTextContent('The order was sent yesterday')
		expect(after.querySelector('p')).toHaveTextContent('The order was delivered today')
		expect(marked(before, 'del')).toEqual(['sent', 'yesterday'])
		expect(marked(after, 'ins')).toEqual(['delivered', 'today'])
		expect(marked(before, 'ins')).toEqual([])
		expect(marked(after, 'del')).toEqual([])
	})

	it('shows Nepreložené before the first translation and the whole value as added', async () => {
		await renderModal(change('sk', null, 'Objednávka odoslaná'))

		expect(within(block('Pred')).getByText('Nepreložené')).toBeInTheDocument()
		expect(marked(block('Po'), 'ins')).toEqual(['Objednávka odoslaná'])
	})

	it('shows Hodnota vymazaná after a cleared value and the whole old value as removed', async () => {
		await renderModal(change('sk', 'Objednávka odoslaná', null))

		expect(within(block('Po')).getByText('Hodnota vymazaná')).toBeInTheDocument()
		expect(marked(block('Pred'), 'del')).toEqual(['Objednávka odoslaná'])
	})

	it('shows variables and HTML tags as chips in the key and the values, and keeps a changed chip whole', async () => {
		const event = change('cs', 'Další informace o {title}', 'Další <strong>informace</strong> o {name}')
		await renderModal({ ...event, payload: { ...event.payload, name: 'Additional information about {title}' } })

		const chips = (element: Element | null) => Array.from(element?.querySelectorAll('code code') ?? [], (chip) => chip.textContent)
		expect(chips(screen.getByRole('dialog').querySelector('header'))).toEqual(['{title}'])
		expect(marked(block('Pred'), 'del')).toEqual(['{title}'])
		expect(marked(block('Po'), 'ins')).toEqual(['<strong>', '</strong>', '{name}'])
		expect(Array.from(block('Po').querySelectorAll('ins code'), (chip) => chip.textContent)).toEqual(['<strong>', '</strong>', '{name}'])
	})

	it('splits Cyrillic into words, not single letters', async () => {
		await renderModal(change('ru', 'Заказ отправлен', 'Заказ доставлен'))

		expect(marked(block('Pred'), 'del')).toEqual(['отправлен'])
		expect(marked(block('Po'), 'ins')).toEqual(['доставлен'])
	})
})
