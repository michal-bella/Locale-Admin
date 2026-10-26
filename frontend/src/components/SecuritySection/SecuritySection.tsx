import { Button, Text } from '@mantine/core'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import ChangePasswordModal from '@/components/ChangePasswordModal/ChangePasswordModal'
import { Shield } from '@/components/Icons'
import { formatRelativeTime } from '@/lib/formatRelativeTime'

import classes from './SecuritySection.module.css'
import { type SecuritySectionProps } from './types'

/** "Heslo a zabezpečenie" (Figma 3:1912). "Zmeniť heslo" opens `ChangePasswordModal`; without a password (Google only) just a note. */
const SecuritySection = ({ passwordChangedAt }: SecuritySectionProps) => {
	const { t, i18n } = useTranslation()
	const titleId = useId()
	const [modalOpened, setModalOpened] = useState(false)

	return (
		<section aria-labelledby={titleId} className={`${classes.card} flex flex-wrap items-center justify-between gap-4`}>
			<div className='flex flex-col gap-1.5'>
				<Text component='h2' id={titleId} size='sm' fw={700} c='var(--app-color-title)'>
					{t('profilePage.security.title')}
				</Text>
				<Text size='xs' c='var(--app-color-muted)'>
					{passwordChangedAt
						? t('profilePage.security.passwordChanged', { relative: formatRelativeTime(passwordChangedAt, i18n.language) })
						: t('profilePage.security.googleOnly')}
				</Text>
			</div>
			{passwordChangedAt && (
				<>
					<Button variant='default' leftSection={<Shield aria-hidden />} onClick={() => setModalOpened(true)}>
						{t('profilePage.security.changePassword')}
					</Button>
					<ChangePasswordModal opened={modalOpened} onClose={() => setModalOpened(false)} />
				</>
			)}
		</section>
	)
}

export default SecuritySection
