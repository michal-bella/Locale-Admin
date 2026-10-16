import '@/styles/global.css'
import '@/lib/i18n'

import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import queryClient from '@/api/queryClient'
import { router } from '@/routes/router'
import { cssVariablesResolver, mantineTheme } from '@/styles/mantineTheme'

const rootElement = document.getElementById('root')

if (!rootElement) {
	throw new Error('Missing #root element')
}

createRoot(rootElement).render(
	<StrictMode>
		<MantineProvider theme={mantineTheme} cssVariablesResolver={cssVariablesResolver} defaultColorScheme='light'>
			<Notifications />
			<QueryClientProvider client={queryClient}>
				<RouterProvider router={router} />
			</QueryClientProvider>
		</MantineProvider>
	</StrictMode>,
)
