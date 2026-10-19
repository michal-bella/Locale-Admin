import { Badge } from '@mantine/core'
import { useTranslation } from 'react-i18next'

import { ROLE } from '@locale/shared'

import classes from './RoleBadge.module.css'
import { type RoleBadgeProps } from './types'

/** Global role of a user as a pill: Administrátor in the brand tint, Člen muted. */
const RoleBadge = ({ role }: RoleBadgeProps) => {
	const { t } = useTranslation()

	return (
		<Badge radius='xl' className={`${classes.badge} ${role === ROLE.ADMIN ? classes.admin : classes.member}`}>
			{t(`roles.${role}`)}
		</Badge>
	)
}

export default RoleBadge
