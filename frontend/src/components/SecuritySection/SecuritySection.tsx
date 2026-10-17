import { Button, Text } from '@mantine/core'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import { Shield } from '@/components/Icons'
import { formatRelativeTime } from '@/lib/formatRelativeTime'

import classes from './SecuritySection.module.css'
import { type SecuritySectionProps } from './types'

/** "Heslo a zabezpečenie" (Figma 3:1912). Changing the password is not in the MVP. */
const SecuritySection = ({ passwordChangedAt }: SecuritySectionProps) => {
	const { t, i18n } = useTranslation()
	const titleId = useId()

	return (
		<section aria-labelledby={titleId} className={`${classes.card} flex flex-wrap items-center justify-between gap-4`}>
			<div className='flex flex-col gap-1.5'>
				<div className='flex items-center gap-2'>
					<Shield aria-hidden className={classes.icon} />
					<Text component='h2' id={titleId} size='sm' fw={700} c='var(--app-color-title)'>
						{t('profilePage.security.title')}
					</Text>
				</div>
				<Text size='xs' c='var(--app-color-muted)'>
					{t('profilePage.security.passwordChanged', { relative: formatRelativeTime(passwordChangedAt, i18n.language) })}
				</Text>
			</div>
			<Button variant='default' disabled>
				{t('profilePage.security.changePassword')}
			</Button>
		</section>
	)
}

export default SecuritySection
