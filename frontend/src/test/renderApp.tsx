import { MantineProvider } from '@mantine/core'
import { QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { render } from '@testing-library/react'

import queryClient from '@/api/queryClient'
import { DEFAULT_COLOR_SCHEME } from '@/lib/constants'
import { createAppRouter } from '@/routes/router'
import { colorSchemeManager, cssVariablesResolver, mantineTheme } from '@/styles/mantineTheme'

/** Renders the whole app (providers + router) at `path`. `env='test'` turns off Mantine transitions and portals. */
export const renderApp = (path: string) => {
	const router = createAppRouter({ history: createMemoryHistory({ initialEntries: [path] }) })
	render(
		<MantineProvider
			theme={mantineTheme}
			cssVariablesResolver={cssVariablesResolver}
			colorSchemeManager={colorSchemeManager}
			defaultColorScheme={DEFAULT_COLOR_SCHEME}
			env='test'
		>
			<QueryClientProvider client={queryClient}>
				<RouterProvider router={router} />
			</QueryClientProvider>
		</MantineProvider>,
	)
	return router
}
