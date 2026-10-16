import { Button } from '@mantine/core'
import { useRouter } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import getApiErrorCode from '@/api/getApiErrorCode'
import ButtonLink from '@/atoms/ButtonLink/ButtonLink'
import CenteredLayout from '@/components/CenteredLayout/CenteredLayout'
import PageIntro from '@/components/PageIntro/PageIntro'

import { type ErrorPageProps } from './types'

/** Generic route error (backend down, 5xx). Shows only the translated error code, never the backend message. */
const ErrorPage = ({ error, inAppLayout = false }: ErrorPageProps) => {
	const { t } = useTranslation()
	const router = useRouter()

	const content = (
		<>
			<PageIntro eyebrow={t('errorPage.eyebrow')} title={t('errorPage.title')} description={t(`errors.${getApiErrorCode(error)}`)} />
			{/* invalidate() re-runs beforeLoad and loaders; the boundary's reset() alone would not. */}
			<Button fullWidth mt='xl' onClick={() => void router.invalidate()}>
				{t('errorPage.retry')}
			</Button>
			<ButtonLink to='/' variant='default' fullWidth mt='sm'>
				{t('errorPage.backHome')}
			</ButtonLink>
		</>
	)

	return inAppLayout ? (
		<div className='flex flex-1 items-center justify-center px-6 py-12'>
			<div className='w-full max-w-[380px]'>{content}</div>
		</div>
	) : (
		<CenteredLayout>{content}</CenteredLayout>
	)
}

export default ErrorPage
