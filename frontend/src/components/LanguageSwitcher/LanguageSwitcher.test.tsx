import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'

import { LOCALE_STORAGE_KEY } from '@/lib/constants'
import { EDITOR_USER, signedInAs } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'

describe('LanguageSwitcher', () => {
	it('switches the UI language without a reload and stores it', async () => {
		signedInAs(EDITOR_USER)
		renderApp('/')

		expect(await screen.findByRole('button', { name: 'Menu používateľa' })).toBeInTheDocument()
		fireEvent.click(screen.getByRole('radio', { name: 'English' }))

		expect(await screen.findByRole('button', { name: 'User menu' })).toBeInTheDocument()
		expect(screen.getByRole('radio', { name: 'English' })).toBeChecked()
		expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en')
		expect(document.documentElement.lang).toBe('en')
	})

	it('names the options by the full language name and shows the short code', async () => {
		signedInAs(EDITOR_USER)
		renderApp('/')

		expect(await screen.findByRole('radio', { name: 'Slovenčina' })).toBeChecked()
		expect(screen.getByRole('radio', { name: 'English' })).not.toBeChecked()
		expect(screen.getByText('SK')).toHaveAttribute('aria-hidden', 'true')
	})
})
