import { useTranslation } from 'react-i18next'

import ButtonLink from '@/atoms/ButtonLink/ButtonLink'
import PageIntro from '@/components/PageIntro/PageIntro'

/** A project that does not exist or that the user is not a member of (the BE does not tell them apart). Rendered inside the app layout. */
const ProjectNotFoundPage = () => {
	const { t } = useTranslation()

	return (
		<div className='flex flex-1 items-center justify-center px-6 py-12'>
			<div className='w-full max-w-[380px]'>
				<PageIntro
					eyebrow={t('projectNotFoundPage.eyebrow')}
					title={t('projectNotFoundPage.title')}
					description={t('projectNotFoundPage.description')}
				/>
				<ButtonLink to='/' fullWidth mt='xl'>
					{t('projectNotFoundPage.backHome')}
				</ButtonLink>
			</div>
		</div>
	)
}

export default ProjectNotFoundPage
