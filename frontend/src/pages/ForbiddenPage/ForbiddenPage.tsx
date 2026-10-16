import { useTranslation } from 'react-i18next'

import ButtonLink from '@/atoms/ButtonLink/ButtonLink'
import PageIntro from '@/components/PageIntro/PageIntro'

/** Rendered inside the app layout (the top bar already shows the brand), so it has no `CenteredLayout`. */
const ForbiddenPage = () => {
	const { t } = useTranslation()

	return (
		<div className='flex flex-1 items-center justify-center px-6 py-12'>
			<div className='w-full max-w-[380px]'>
				<PageIntro eyebrow={t('forbiddenPage.eyebrow')} title={t('forbiddenPage.title')} description={t('forbiddenPage.description')} />
				<ButtonLink to='/' fullWidth mt='xl'>
					{t('forbiddenPage.backHome')}
				</ButtonLink>
			</div>
		</div>
	)
}

export default ForbiddenPage
