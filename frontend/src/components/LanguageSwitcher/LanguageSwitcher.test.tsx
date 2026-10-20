import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'

import { LOCALE_STORAGE_KEY } from '@/lib/constants'
import { EDITOR_USER, signedInAs } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'

const openSwitcher = async (label: string) => {
	fireEvent.click(await screen.findByRole('combobox', { name: label }))
	return within(await screen.findByRole('listbox'))
}

describe('LanguageSwitcher', () => {
	it('switches the UI language without a reload and stores it', async () => {
		signedInAs(EDITOR_USER)
		renderApp('/')

		expect(await screen.findByRole('button', { name: /^Menu používateľa/ })).toBeInTheDocument()
		fireEvent.click((await openSwitcher('Jazyk')).getByRole('option', { name: 'English' }))

		expect(await screen.findByRole('button', { name: /^User menu/ })).toBeInTheDocument()
		expect(screen.getByRole('combobox', { name: 'Language' })).toHaveValue('English')
		expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en')
		expect(document.documentElement.lang).toBe('en')
	})

	it('offers Slovak, Czech and English by their own names, each with a decorative flag', async () => {
		signedInAs(EDITOR_USER)
		renderApp('/')

		expect(await screen.findByRole('combobox', { name: 'Jazyk' })).toHaveValue('Slovenčina')
		const options = (await openSwitcher('Jazyk')).getAllByRole('option')
		expect(options.map((option) => option.textContent)).toEqual(['Slovenčina', 'Čeština', 'English'])
		for (const option of options) {
			expect(option.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
		}
	})

	it('switches to Czech', async () => {
		signedInAs(EDITOR_USER)
		renderApp('/')

		fireEvent.click((await openSwitcher('Jazyk')).getByRole('option', { name: 'Čeština' }))

		expect(await screen.findByRole('button', { name: /^Menu uživatele/ })).toBeInTheDocument()
		expect(screen.getByRole('combobox', { name: 'Jazyk' })).toHaveValue('Čeština')
		expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('cs')
		expect(document.documentElement.lang).toBe('cs')
	})
})
