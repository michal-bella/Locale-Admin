import { Button, Skeleton, Text } from '@mantine/core'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import getApiErrorCode from '@/api/getApiErrorCode'
import { useLanguagesQuery } from '@/api/languages/languagesQuery'
import { useProjectSettingsQuery } from '@/api/projectSettings/projectSettingsQuery'
import PageIntro from '@/components/PageIntro/PageIntro'
import ProjectSettingsForm from '@/components/ProjectSettingsForm/ProjectSettingsForm'

import classes from './ProjectSettingsPage.module.css'

/** Heights of the two cards in Figma 3:1557 (the first one with the base language row), used for the loading skeletons. */
const SKELETON_HEIGHTS = [330, 152]

/** Figma 3:1557 without the breadcrumbs and help icon, plus the base language and "Opustiť projekt". ADMIN only. */
const ProjectSettingsPage = () => {
	const { t } = useTranslation()
	const settingsQuery = useProjectSettingsQuery()
	const languagesQuery = useLanguagesQuery()
	const [retrySucceeded, setRetrySucceeded] = useState(false)
	const failedQueries = [settingsQuery, languagesQuery].filter((query) => query.isError && query.data === undefined)

	const retry = async () => {
		const results = await Promise.all(failedQueries.map((query) => query.refetch()))
		setRetrySucceeded(results.every(({ isSuccess }) => isSuccess))
	}

	const renderContent = () => {
		if (failedQueries.length > 0) {
			return (
				<div className={`${classes.state} flex flex-col items-center gap-1`}>
					<Text size='sm' fw={600} c='var(--app-color-text-strong)'>
						{t('projectSettingsPage.loadError')}
					</Text>
					<Text size='xs'>{t(`errors.${getApiErrorCode(failedQueries[0]?.error)}`)}</Text>
					<Button variant='default' mt='md' loading={failedQueries.some((query) => query.isRefetching)} onClick={() => void retry()}>
						{t('projectSettingsPage.retry')}
					</Button>
				</div>
			)
		}
		if (!settingsQuery.data || !languagesQuery.data) {
			return (
				<div aria-busy='true' className='flex flex-col gap-5'>
					{SKELETON_HEIGHTS.map((height) => (
						<Skeleton key={height} height={height} radius='xl' />
					))}
				</div>
			)
		}
		return <ProjectSettingsForm settings={settingsQuery.data} languages={languagesQuery.data} focusFirstField={retrySucceeded} />
	}

	return (
		<div className='mx-auto flex w-full max-w-[980px] flex-col gap-6 p-8'>
			<PageIntro
				eyebrow={t('projectSettingsPage.eyebrow')}
				title={t('projectSettingsPage.title')}
				description={t('projectSettingsPage.description')}
				titleSize='h2'
			/>
			{renderContent()}
		</div>
	)
}

export default ProjectSettingsPage
