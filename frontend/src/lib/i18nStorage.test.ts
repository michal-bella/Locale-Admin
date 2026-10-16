import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { LOCALE_STORAGE_KEY } from '@/lib/constants'
import { LANGUAGE } from '@/lib/enum'

// lib/i18n reads the stored language once at import time, so each case imports a fresh copy of the module.
const importFreshI18n = async () => {
	vi.resetModules()
	const { default: i18n } = await import('@/lib/i18n')
	return i18n
}

describe('i18n language storage', () => {
	beforeEach(() => {
		localStorage.clear()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it('uses the stored language on init', async () => {
		localStorage.setItem(LOCALE_STORAGE_KEY, LANGUAGE.EN)

		const i18n = await importFreshI18n()

		expect(i18n.language).toBe(LANGUAGE.EN)
	})

	it('falls back to sk for an invalid stored value', async () => {
		localStorage.setItem(LOCALE_STORAGE_KEY, 'de')

		const i18n = await importFreshI18n()

		expect(i18n.language).toBe(LANGUAGE.SK)
	})

	it('falls back to sk when reading localStorage throws', async () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new DOMException('blocked', 'SecurityError')
		})

		const i18n = await importFreshI18n()

		expect(i18n.language).toBe(LANGUAGE.SK)
	})

	it('still switches the language when storing it throws', async () => {
		const i18n = await importFreshI18n()
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new DOMException('full', 'QuotaExceededError')
		})

		await i18n.changeLanguage(LANGUAGE.EN)

		expect(i18n.language).toBe(LANGUAGE.EN)
		expect(document.documentElement.lang).toBe(LANGUAGE.EN)
		expect(localStorage.getItem(LOCALE_STORAGE_KEY)).not.toBe(LANGUAGE.EN)
	})

	it('stores the chosen language', async () => {
		const i18n = await importFreshI18n()

		await i18n.changeLanguage(LANGUAGE.EN)

		expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe(LANGUAGE.EN)
	})
})
