import { Button, Text } from '@mantine/core'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import { File } from '@/components/Icons'

import classes from './OnboardingGuideSection.module.css'

/** Link to the editor onboarding PDF (`/onboarding`), opened in a new tab in the UI language. */
const OnboardingGuideSection = () => {
	const { t } = useTranslation()
	const titleId = useId()

	return (
		<section aria-labelledby={titleId} className={`${classes.card} flex flex-wrap items-center justify-between gap-4`}>
			<div className='flex flex-col gap-1.5'>
				<Text component='h2' id={titleId} size='sm' fw={700} c='var(--app-color-title)'>
					{t('profilePage.onboarding.title')}
				</Text>
				<Text size='xs' c='var(--app-color-muted)'>
					{t('profilePage.onboarding.description')}
				</Text>
			</div>
			<Button component='a' href='/onboarding' target='_blank' rel='noopener noreferrer' variant='default' leftSection={<File aria-hidden />}>
				{t('profilePage.onboarding.open')}
			</Button>
		</section>
	)
}

export default OnboardingGuideSection
