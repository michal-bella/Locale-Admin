import '@testing-library/jest-dom/vitest'

import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vite-plus/test'

import queryClient from '@/api/queryClient'
import { DEFAULT_LANGUAGE } from '@/lib/constants'
import i18n from '@/lib/i18n'
import { resetApiMock } from '@/test/mockApi'

// The full run renders ~36 files in parallel and every test gets ~3x slower, the first one of a file (cold lazy route) the most.
// The default 1 s for findBy*/waitFor then times out; 3 s stays under Vitest's 5 s test timeout so the findBy error still shows.
configure({ asyncUtilTimeout: 3000 })

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
		// Reduced motion makes CountUp show the final number at once.
		matches: query === '(prefers-reduced-motion: reduce)',
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

// jsdom has no document.fonts (the autosize Textarea listens for loaded fonts).
Object.defineProperty(document, 'fonts', { value: { addEventListener: () => undefined, removeEventListener: () => undefined } })
