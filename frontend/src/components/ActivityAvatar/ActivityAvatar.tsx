import { Avatar } from '@mantine/core'
import { type CSSProperties } from 'react'

import { ACTIVITY_TYPE_CATEGORY } from '@locale/shared'

import { ACTIVITY_CATEGORY_STYLE } from '@/lib/activityCategoryStyle'
import { getNameInitials } from '@/lib/utils'

import classes from './ActivityAvatar.module.css'
import { type ActivityAvatarProps } from './types'

/** Initials of who made the change with what it changed as a colored icon on the corner; decorative, the row says the same in words. */
const ActivityAvatar = ({ event }: ActivityAvatarProps) => {
	const category = ACTIVITY_CATEGORY_STYLE[ACTIVITY_TYPE_CATEGORY[event.type]]

	return (
		<span className={classes.avatar} aria-hidden>
			<Avatar size={32} radius='xl' color='var(--app-color-avatar-muted)' variant='filled' classNames={{ placeholder: classes.initials }}>
				{event.user ? getNameInitials(event.user.name) : '?'}
			</Avatar>
			<span className={classes.category} style={{ '--category-color': `var(--mantine-color-${category.color}-filled)` } as CSSProperties}>
				<category.icon />
			</span>
		</span>
	)
}

export default ActivityAvatar
