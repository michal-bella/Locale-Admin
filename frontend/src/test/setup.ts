import '@testing-library/jest-dom/vitest'
import '@/lib/i18n'

import { cleanup } from '@testing-library/react'
import { afterEach } from 'vite-plus/test'

afterEach(() => {
	cleanup()
})

// jsdom has no matchMedia (read by Mantine) and no scrollTo (called by the router on navigation).
Object.defineProperty(window, 'scrollTo', { writable: true, value: () => undefined })

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
