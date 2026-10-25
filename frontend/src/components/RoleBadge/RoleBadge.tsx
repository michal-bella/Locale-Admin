import { Badge } from '@mantine/core'
import { useTranslation } from 'react-i18next'

import { canManageProject } from '@locale/shared'

import classes from './RoleBadge.module.css'
import { type RoleBadgeProps } from './types'

/** Global role of a user as a pill: Administrátor and Správca in the brand tint, Editor and Návštevník muted. */
const RoleBadge = ({ role }: RoleBadgeProps) => {
	const { t } = useTranslation()

	return (
		<Badge radius='xl' className={`${classes.badge} ${canManageProject(role) ? classes.admin : classes.member}`}>
			{t(`roles.${role}`)}
		</Badge>
	)
}

export default RoleBadge
