import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

/** Sets `document.title` to "<page> – Locale"; `page` is already translated, so the title follows a language switch. */
export const useDocumentTitle = (page: string) => {
	const { t } = useTranslation()
	const title = t('documentTitle', { page })

	useEffect(() => {
		document.title = title
	}, [title])
}
