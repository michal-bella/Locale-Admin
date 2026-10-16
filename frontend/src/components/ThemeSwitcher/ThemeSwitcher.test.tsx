import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'

import { COLOR_SCHEME_STORAGE_KEY } from '@/lib/constants'
import i18n from '@/lib/i18n'
import { EDITOR_USER, signedInAs } from '@/test/mockApi'
import { renderApp } from '@/test/renderApp'

const getColorScheme = () => document.documentElement.getAttribute('data-mantine-color-scheme')

describe('ThemeSwitcher', () => {
	it('starts light and toggles dark and back, storing the choice', async () => {
		signedInAs(EDITOR_USER)
		renderApp('/')

		fireEvent.click(await screen.findByRole('button', { name: 'Prepnúť na tmavý režim' }))

		expect(await screen.findByRole('button', { name: 'Prepnúť na svetlý režim' })).toBeInTheDocument()
		expect(getColorScheme()).toBe('dark')
		expect(localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)).toBe('dark')

		fireEvent.click(screen.getByRole('button', { name: 'Prepnúť na svetlý režim' }))

		expect(await screen.findByRole('button', { name: 'Prepnúť na tmavý režim' })).toBeInTheDocument()
		expect(getColorScheme()).toBe('light')
		expect(localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)).toBe('light')
	})

	it('restores the stored dark scheme', async () => {
		localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, 'dark')
		signedInAs(EDITOR_USER)
		renderApp('/')

		expect(await screen.findByRole('button', { name: 'Prepnúť na svetlý režim' })).toBeInTheDocument()
		expect(getColorScheme()).toBe('dark')
	})

	it('has English names', async () => {
		await i18n.changeLanguage('en')
		signedInAs(EDITOR_USER)
		renderApp('/')

		fireEvent.click(await screen.findByRole('button', { name: 'Switch to dark mode' }))

		expect(await screen.findByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument()
	})
})
