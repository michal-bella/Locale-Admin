import { Text } from '@mantine/core'
import { useId } from 'react'

import classes from './ProfileSection.module.css'
import { type ProfileSectionProps } from './types'

/** Card with a titled header used by the "Osobné údaje" and "Preferencie" sections of the profile page (Figma 3:1825, 3:1859). */
const ProfileSection = ({ title, description, children }: ProfileSectionProps) => {
	const titleId = useId()

	return (
		<section aria-labelledby={titleId} className={classes.card}>
			<div className={`${classes.header} flex flex-col gap-1`}>
				<Text component='h2' id={titleId} size='sm' fw={700} c='slate.9'>
					{title}
				</Text>
				<Text size='xs' c='slate.4'>
					{description}
				</Text>
			</div>
			<div className={classes.body}>{children}</div>
		</section>
	)
}

export default ProfileSection
