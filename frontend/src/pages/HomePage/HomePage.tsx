import { Title, VisuallyHidden } from '@mantine/core'
import { useTranslation } from 'react-i18next'

import { useDocumentTitle } from '@/hooks/useDocumentTitle'

/** Blank in phase 1; content comes in later phases. The app layout provides the `<main>` element. */
const HomePage = () => {
	const { t } = useTranslation()
	useDocumentTitle(t('homePage.title'))

	return (
		<VisuallyHidden>
			<Title order={1}>{t('homePage.title')}</Title>
		</VisuallyHidden>
	)
}

export default HomePage
