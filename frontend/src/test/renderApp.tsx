import { MantineProvider } from '@mantine/core'
import { QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { render } from '@testing-library/react'

import queryClient from '@/api/queryClient'
import { createAppRouter } from '@/routes/router'
import { mantineTheme } from '@/styles/mantineTheme'

/** Renders the whole app (providers + router) at `path`. `env='test'` turns off Mantine transitions and portals. */
export const renderApp = (path: string) => {
	const router = createAppRouter({ history: createMemoryHistory({ initialEntries: [path] }) })
	render(
		<MantineProvider theme={mantineTheme} env='test'>
			<QueryClientProvider client={queryClient}>
				<RouterProvider router={router} />
			</QueryClientProvider>
		</MantineProvider>,
	)
	return router
}
