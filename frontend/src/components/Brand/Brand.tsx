import { Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'

import { Logo } from '@/components/Icons'

import classes from './Brand.module.css'

/** `compact` shows only the logo (compact sidebar). */
const Brand = ({ compact = false }: { compact?: boolean }) => {
	const { t } = useTranslation()

	return (
		<div className={`flex items-center gap-2.5 ${compact ? '' : 'px-2'}`}>
			<div className={classes.logo}>
				<Logo aria-hidden />
			</div>
			{!compact && (
				<div className='flex flex-col'>
					<Text component='span' fw={700} c='var(--app-color-title)' lh={1.5} className={classes.name}>
						{t('brand.name')}
					</Text>
					<Text component='span' fz='3xs' fw={600} c='var(--app-color-muted)' lh={1.5} tt='uppercase' className={classes.tagline}>
						{t('brand.tagline')}
					</Text>
				</div>
			)}
		</div>
	)
}

export default Brand
