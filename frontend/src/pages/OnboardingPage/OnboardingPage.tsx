import { useTranslation } from 'react-i18next'

import Brand from '@/components/Brand/Brand'
import PageIntro from '@/components/PageIntro/PageIntro'
import { onboardingGuidePath } from '@/lib/onboardingGuide'

import classes from './OnboardingPage.module.css'

/** Editor guide in the browser's own PDF viewer, which also offers the download. */
const OnboardingPage = () => {
	const { t, i18n } = useTranslation()

	return (
		<div className='flex min-h-dvh flex-col items-center gap-10 px-6 py-12'>
			<Brand />
			<main className='flex w-full max-w-[1100px] flex-1 flex-col gap-8'>
				<PageIntro eyebrow={t('onboardingPage.eyebrow')} title={t('onboardingPage.title')} description={t('onboardingPage.description')} />
				<iframe src={onboardingGuidePath(i18n.language)} title={t('onboardingPage.title')} className={classes.viewer} />
			</main>
		</div>
	)
}

export default OnboardingPage
