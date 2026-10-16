import { MantineProvider } from '@mantine/core'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'

import { createAppRouter } from '@/routes/router'
import { mantineTheme } from '@/styles/mantineTheme'

describe('NotFoundPage', () => {
	it('renders for an unknown route with a link back home', async () => {
		const router = createAppRouter({ history: createMemoryHistory({ initialEntries: ['/does-not-exist'] }) })
		render(
			<MantineProvider theme={mantineTheme}>
				<RouterProvider router={router} />
			</MantineProvider>,
		)

		expect(await screen.findByRole('heading', { level: 1, name: 'Stránka sa nenašla' })).toBeInTheDocument()
		expect(screen.getByRole('link', { name: 'Späť na úvod' })).toHaveAttribute('href', '/')
	})
})
