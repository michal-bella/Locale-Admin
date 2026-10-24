import { Alert, Button } from '@mantine/core'
import { useTranslation } from 'react-i18next'

import { AlertTriangle } from '@/components/Icons'

import classes from './TranslationsWarningsBanner.module.css'
import { type TranslationsWarningsBannerProps } from './types'

/**
 * Yellow banner above the translations card when some keys have a placeholder warning (e.g. after an import). It only says how many and
 * turns the `warnings` filter on or off; the rows themselves show what is wrong (chips and icons).
 */
const TranslationsWarningsBanner = ({ count, active, onShow, onClear }: TranslationsWarningsBannerProps) => {
	const { t } = useTranslation()

	return (
		<Alert color='yellow' icon={<AlertTriangle aria-hidden />} classNames={{ root: classes.root, icon: classes.icon, message: classes.message }}>
			<span>{t('translationsPage.warnings.message', { count })}</span>
			{active ? (
				<Button variant='default' size='xs' onClick={onClear}>
					{t('translationsPage.warnings.clear')}
				</Button>
			) : (
				<Button color='yellow' autoContrast size='xs' onClick={onShow}>
					{t('translationsPage.warnings.show')}
				</Button>
			)}
		</Alert>
	)
}

export default TranslationsWarningsBanner
