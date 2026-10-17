import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach } from 'vite-plus/test'

import queryClient from '@/api/queryClient'
import { DEFAULT_LANGUAGE } from '@/lib/constants'
import i18n from '@/lib/i18n'
import { resetApiMock } from '@/test/mockApi'

afterEach(async () => {
	cleanup()
	queryClient.clear()
	resetApiMock()
	await i18n.changeLanguage(DEFAULT_LANGUAGE)
	localStorage.clear()
})

// jsdom has no matchMedia (read by Mantine), no ResizeObserver (SegmentedControl), no scrollTo (called by the router on navigation)
// and no scrollIntoView (called by the Select dropdown on the selected option).
Object.defineProperty(window, 'scrollTo', { writable: true, value: () => undefined })

Object.defineProperty(Element.prototype, 'scrollIntoView', { writable: true, value: () => undefined })

Object.defineProperty(window, 'matchMedia', {
	writable: true,
	value: (query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addEventListener: () => undefined,
		removeEventListener: () => undefined,
		addListener: () => undefined,
		removeListener: () => undefined,
		dispatchEvent: () => false,
	}),
})

Object.defineProperty(window, 'ResizeObserver', {
	writable: true,
	value: class {
		observe() {}
		unobserve() {}
		disconnect() {}
	},
})
