import { useTranslation } from 'react-i18next'

import ButtonLink from '@/atoms/ButtonLink/ButtonLink'
import CenteredLayout from '@/components/CenteredLayout/CenteredLayout'
import PageIntro from '@/components/PageIntro/PageIntro'

const NotFoundPage = () => {
	const { t } = useTranslation()

	return (
		<CenteredLayout>
			<PageIntro eyebrow={t('notFoundPage.eyebrow')} title={t('notFoundPage.title')} description={t('notFoundPage.description')} />
			<ButtonLink to='/' fullWidth mt='xl'>
				{t('notFoundPage.backHome')}
			</ButtonLink>
		</CenteredLayout>
	)
}

export default NotFoundPage
