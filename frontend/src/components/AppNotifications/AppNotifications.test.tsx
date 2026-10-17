import { MantineProvider } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vite-plus/test'

import i18n from '@/lib/i18n'
import { mantineTheme } from '@/styles/mantineTheme'

import AppNotifications from './AppNotifications'

const renderNotifications = () =>
	render(
		<MantineProvider theme={mantineTheme} env='test'>
			<AppNotifications />
		</MantineProvider>,
	)

afterEach(() => {
	act(() => notifications.clean())
})

describe('AppNotifications', () => {
	it('announces the notification and names its close button in the active language', async () => {
		renderNotifications()
		act(() => {
			notifications.show({ message: 'Uložené' })
		})

		expect(await screen.findByRole('alert')).toHaveTextContent('Uložené')
		expect(screen.getByRole('button', { name: 'Zavrieť notifikáciu' })).toBeInTheDocument()

		await act(() => i18n.changeLanguage('en'))
		expect(screen.getByRole('button', { name: 'Close notification' })).toBeInTheDocument()
	})
})
