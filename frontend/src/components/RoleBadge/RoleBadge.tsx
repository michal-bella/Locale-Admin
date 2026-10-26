import { Badge } from '@mantine/core'
import { useTranslation } from 'react-i18next'

import { PROJECT_ROLE, ROLE } from '@locale/shared'

import classes from './RoleBadge.module.css'
import { type RoleBadgeProps } from './types'

/** Global role of a user or role of a member as a pill: Administrátor and Správca in the brand tint, the others muted. */
const RoleBadge = ({ role }: RoleBadgeProps) => {
	const { t } = useTranslation()

	return (
		<Badge radius='xl' className={`${classes.badge} ${role === ROLE.ADMIN || role === PROJECT_ROLE.MANAGER ? classes.admin : classes.member}`}>
			{t(`roles.${role}`)}
		</Badge>
	)
}

export default RoleBadge
