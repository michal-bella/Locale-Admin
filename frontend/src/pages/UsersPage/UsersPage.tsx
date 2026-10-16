import { useTranslation } from 'react-i18next'

import PageIntro from '@/components/PageIntro/PageIntro'

/** Placeholder in milestone B; the user table and the create modal come in milestone C. */
const UsersPage = () => {
	const { t } = useTranslation()

	return (
		<div className='mx-auto w-full max-w-[1200px] p-8'>
			<PageIntro eyebrow={t('usersPage.eyebrow')} title={t('usersPage.title')} description={t('usersPage.description')} />
		</div>
	)
}

export default UsersPage
