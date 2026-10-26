import { Badge } from '@mantine/core'
import { useTranslation } from 'react-i18next'

import classes from './BlockedBadge.module.css'

/** Zablokovaný next to the role of a user an ADMIN blocked (`isActive: false`). */
const BlockedBadge = () => {
	const { t } = useTranslation()

	return (
		<Badge color='red' variant='light' radius='xl' className={classes.badge}>
			{t('usersPage.table.blocked')}
		</Badge>
	)
}

export default BlockedBadge
