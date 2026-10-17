import { Avatar, Button, Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'

import { getInitials } from '@locale/shared'

import { Upload } from '@/components/Icons'

import classes from './ProfileCard.module.css'
import { type ProfileCardProps } from './types'

/** Header card of the profile page (Figma 3:1805): avatar with initials, name and global role. Photo upload is not in the MVP. */
const ProfileCard = ({ profile }: ProfileCardProps) => {
	const { t } = useTranslation()
	const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ')

	return (
		<section className={classes.card}>
			<div className={classes.cover}>
				<Avatar
					aria-hidden
					size={88}
					radius='xl'
					color='slate.9'
					variant='filled'
					className={classes.avatar}
					classNames={{ placeholder: classes.initials }}
				>
					{getInitials(profile)}
				</Avatar>
			</div>
			<div className={`${classes.body} flex flex-wrap items-start justify-between gap-4`}>
				<div className='flex flex-col gap-1'>
					<Text component='h2' fz='lg' fw={700} c='slate.9' className={classes.name}>
						{fullName || profile.email}
					</Text>
					<Text size='xs' c='slate.4'>
						{t(`profilePage.roles.${profile.role}`)}
					</Text>
				</div>
				<Button variant='default' leftSection={<Upload aria-hidden />} disabled>
					{t('profilePage.card.changePhoto')}
				</Button>
			</div>
		</section>
	)
}

export default ProfileCard
