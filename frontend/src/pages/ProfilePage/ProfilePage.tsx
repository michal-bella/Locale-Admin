import { Button, Skeleton, Text } from '@mantine/core'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import getApiErrorCode from '@/api/getApiErrorCode'
import { useProfileQuery } from '@/api/profile/profileQuery'
import PageIntro from '@/components/PageIntro/PageIntro'
import ProfileForm from '@/components/ProfileForm/ProfileForm'

import classes from './ProfilePage.module.css'

/** Heights of the profile cards in Figma 3:1762, used for the loading skeletons. */
const SKELETON_HEIGHTS = [242, 248, 290, 84]

/** Figma 3:1762 without the sidebar, breadcrumbs and help icon (phase 1 layout). */
const ProfilePage = () => {
	const { t } = useTranslation()
	const { data, isPending, isError, error, refetch, isRefetching } = useProfileQuery()
	const [retrySucceeded, setRetrySucceeded] = useState(false)

	const retry = async () => {
		const { isSuccess } = await refetch()
		setRetrySucceeded(isSuccess)
	}

	const renderContent = () => {
		if (isPending) {
			return (
				<div aria-busy='true' className='flex flex-col gap-5'>
					{SKELETON_HEIGHTS.map((height) => (
						<Skeleton key={height} height={height} radius='xl' />
					))}
				</div>
			)
		}
		if (isError) {
			return (
				<div className={`${classes.state} flex flex-col items-center gap-1`}>
					<Text size='sm' fw={600} c='var(--app-color-text-strong)'>
						{t('profilePage.loadError')}
					</Text>
					<Text size='xs'>{t(`errors.${getApiErrorCode(error)}`)}</Text>
					<Button variant='default' mt='md' loading={isRefetching} onClick={() => void retry()}>
						{t('profilePage.retry')}
					</Button>
				</div>
			)
		}
		return <ProfileForm profile={data} focusFirstField={retrySucceeded} />
	}

	return (
		<div className='mx-auto flex w-full max-w-[980px] flex-col gap-6 p-8'>
			<PageIntro eyebrow={t('profilePage.eyebrow')} title={t('profilePage.title')} description={t('profilePage.description')} titleSize='h2' />
			{renderContent()}
		</div>
	)
}

export default ProfilePage
