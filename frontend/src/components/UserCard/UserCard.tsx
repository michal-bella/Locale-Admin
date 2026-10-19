import { Avatar, Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'

import { getInitials } from '@locale/shared'

import RoleBadge from '@/components/RoleBadge/RoleBadge'
import { formatDate } from '@/lib/formatDate'

import classes from './UserCard.module.css'
import { type UserCardProps } from './types'

/** Header card of the user detail: avatar with initials from the email, the email, the global role and the created date. */
const UserCard = ({ user }: UserCardProps) => {
	const { t, i18n } = useTranslation()

	return (
		<section aria-label={t('userPage.card.label')} className={`${classes.card} flex items-center gap-4`}>
			<Avatar aria-hidden size={56} radius='xl' color='var(--app-color-avatar-muted)' variant='filled' classNames={{ placeholder: classes.initials }}>
				{getInitials({ email: user.email, firstName: null, lastName: null })}
			</Avatar>
			<div className='flex min-w-0 flex-col gap-1'>
				<Text component='h2' fz='lg' fw={700} c='var(--app-color-title)' className={classes.email}>
					{user.email}
				</Text>
				<div className='flex flex-wrap items-center gap-3'>
					<RoleBadge role={user.role} />
					<Text size='xs' c='var(--app-color-muted)'>
						{t('userPage.card.createdAt', { date: formatDate(user.createdAt, i18n.language) })}
					</Text>
				</div>
			</div>
		</section>
	)
}

export default UserCard
