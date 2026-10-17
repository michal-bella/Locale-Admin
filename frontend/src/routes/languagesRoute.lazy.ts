import { createLazyRoute } from '@tanstack/react-router'

import LanguagesPage from '@/pages/LanguagesPage/LanguagesPage'

export const Route = createLazyRoute('/_authenticated/languages')({
	component: LanguagesPage,
})
