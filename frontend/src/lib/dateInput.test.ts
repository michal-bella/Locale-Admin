import { describe, expect, it } from 'vite-plus/test'

import { parseDateInput, toDayjsLocale } from './dateInput'

describe('parseDateInput', () => {
	it('accepts the contract format and the numeric day-first forms', () => {
		expect(parseDateInput('2026-10-22')).toBe('2026-10-22')
		expect(parseDateInput('22. 10. 2026')).toBe('2026-10-22')
		expect(parseDateInput('2.9.2026')).toBe('2026-09-02')
		expect(parseDateInput('22/10/2026')).toBe('2026-10-22')
	})

	it('rejects partial input and impossible dates', () => {
		expect(parseDateInput('22. 10.')).toBeNull()
		expect(parseDateInput('2026-02-30')).toBeNull()
		expect(parseDateInput('31. 4. 2026')).toBeNull()
		expect(parseDateInput('')).toBeNull()
	})
})

describe('toDayjsLocale', () => {
	it('maps the UI languages and falls back to sk', () => {
		expect(toDayjsLocale('en')).toBe('en-gb')
		expect(toDayjsLocale('cs')).toBe('cs')
		expect(toDayjsLocale('de')).toBe('sk')
	})
})
