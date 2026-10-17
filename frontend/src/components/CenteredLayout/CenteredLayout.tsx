import { Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'

import Brand from '@/components/Brand/Brand'

import { type CenteredLayoutProps } from './types'

/** Full-screen page with the brand on top, centered content and a footer (login, 403, 404). */
const CenteredLayout = ({ children }: CenteredLayoutProps) => {
	const { t } = useTranslation()

	return (
		<div className='flex min-h-dvh flex-col items-center justify-between gap-12 px-6 py-12'>
			<Brand />
			<main className='w-full max-w-[380px]'>{children}</main>
			<Text component='footer' fz='2xs' c='var(--app-color-muted)' lh={1.5}>
				{t('brand.copyright', { year: new Date().getFullYear() })}
			</Text>
		</div>
	)
}

export default CenteredLayout
