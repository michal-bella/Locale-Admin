import { createLazyRoute } from '@tanstack/react-router'

import TranslationsPage from '@/pages/TranslationsPage/TranslationsPage'

export const Route = createLazyRoute('/_authenticated/_app/projects/$projectSlug/translations')({
	component: TranslationsPage,
})
