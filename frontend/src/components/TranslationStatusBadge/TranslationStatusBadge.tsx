import { Badge } from '@mantine/core'
import { useTranslation } from 'react-i18next'

import classes from './TranslationStatusBadge.module.css'
import { type TranslationStatusBadgeProps } from './types'

/** Status of a translation as a pill with a dot: Preložené in teal, Nepreložené in red. Used in the table's Stav column and the status filter. */
const TranslationStatusBadge = ({ status }: TranslationStatusBadgeProps) => {
	const { t } = useTranslation()

	return (
		<Badge
			variant='light'
			color={status === 'TRANSLATED' ? 'teal' : 'red'}
			radius='xl'
			tt='none'
			leftSection={<span aria-hidden className={classes.dot} />}
			className={classes.badge}
		>
			{t(`translationsPage.status.${status}`)}
		</Badge>
	)
}

export default TranslationStatusBadge
