import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'

import { renderApp } from '@/test/renderApp'

describe('OnboardingPage', () => {
	it('shows the guide in the UI language in the PDF viewer', async () => {
		renderApp('/onboarding')

		expect(await screen.findByRole('heading', { name: 'Príručka pre editorov' })).toBeInTheDocument()
		expect(screen.getByTitle('Príručka pre editorov')).toHaveAttribute('src', '/guides/onboarding-editor-sk.pdf')
	})
})
