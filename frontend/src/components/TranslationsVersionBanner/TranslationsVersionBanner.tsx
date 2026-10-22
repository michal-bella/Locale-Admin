import { Alert, Button } from '@mantine/core'
import { useTranslation } from 'react-i18next'

import { daysUntil, toVersionDate } from '@locale/shared'

import { Lock, LockUnlocked, Tag } from '@/components/Icons'

import classes from './TranslationsVersionBanner.module.css'
import { type TranslationsVersionBannerProps } from './types'

/**
 * Countdown of a version above the translations card: how long editors have until the version locks, or that it is locked (and, for an
 * editor, that only an administrator edits it now), and how many keys of its work are still untranslated. The button filters the list to the version's work or clears that filter; an ADMIN
 * also locks or unlocks the version from here.
 */
const TranslationsVersionBanner = ({ version, active, writesBlocked, untranslated, onShow, onClear, onToggleLock }: TranslationsVersionBannerProps) => {
	const { t } = useTranslation()
	// Days are counted in the browser's calendar: the deadline is a day, not a moment.
	const today = toVersionDate(new Date())
	const { name } = version
	const message = (() => {
		if (version.isLocked) {
			return t(writesBlocked ? 'translationsPage.version.lockedEditor' : 'translationsPage.version.locked', { name })
		}
		if (today < version.startsAt) {
			return t('translationsPage.version.upcoming', { name, count: daysUntil(version.startsAt, today) })
		}
		if (today > version.endsAt) {
			return t('translationsPage.version.unlocked', { name })
		}
		const days = daysUntil(version.endsAt, today)
		return days === 0 ? t('translationsPage.version.lastDay', { name }) : t('translationsPage.version.remaining', { name, count: days })
	})()

	return (
		<Alert
			color={version.isLocked ? 'blue' : 'gray'}
			icon={version.isLocked ? <Lock aria-hidden /> : <Tag aria-hidden />}
			classNames={{ root: `${classes.root} ${version.isLocked ? '' : classes.countdown}`, icon: classes.icon, message: classes.message }}
		>
			<span>
				<span>{message}</span>
				{untranslated !== undefined && untranslated > 0 && <span> {t('translationsPage.version.untranslated', { count: untranslated })}</span>}
			</span>
			<div className='flex flex-wrap gap-2'>
				{onToggleLock && (
					<Button
						variant='default'
						size='xs'
						leftSection={version.isLocked ? <LockUnlocked aria-hidden /> : <Lock aria-hidden />}
						aria-label={t(version.isLocked ? 'translationsPage.version.unlockLabel' : 'translationsPage.version.lockLabel', { name })}
						onClick={onToggleLock}
					>
						{t(version.isLocked ? 'translationsPage.version.unlock' : 'translationsPage.version.lock')}
					</Button>
				)}
				{active ? (
					<Button variant='default' size='xs' onClick={onClear}>
						{t('translationsPage.version.clear')}
					</Button>
				) : (
					<Button variant='default' size='xs' onClick={onShow}>
						{t('translationsPage.version.show')}
					</Button>
				)}
			</div>
		</Alert>
	)
}

export default TranslationsVersionBanner
