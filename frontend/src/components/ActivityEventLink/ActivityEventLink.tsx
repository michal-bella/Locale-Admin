import { useTranslation } from 'react-i18next'

import { ACTIVITY_TYPE, ROLE, TRANSLATIONS_SEARCH_MAX_LENGTH, type TranslationsUpdatedWithin } from '@locale/shared'

import { useMeQuery } from '@/api/auth/meQuery'
import { ArrowRight } from '@/components/Icons'
import RowAction from '@/components/RowAction/RowAction'
import { translationEditSearch } from '@/lib/translationEditSearch'
import { type TranslationsSearch } from '@/routes/projectTranslationsRoute'

import { type ActivityEventLinkProps } from './types'

const DAY_MS = 24 * 60 * 60 * 1000

/** The shortest `updatedWithin` of Preklady that still reaches back to the event; older events filter by the user only. */
const updatedWithinFor = (createdAt: string, now: Date): TranslationsUpdatedWithin | undefined => {
	const age = now.getTime() - new Date(createdAt).getTime()
	return age < DAY_MS ? 'DAY' : age < 7 * DAY_MS ? 'WEEK' : age < 30 * DAY_MS ? 'MONTH' : undefined
}

/**
 * The → of an activity row into Preklady: a translation edit opens that translation, a new or changed key filters to it (ADMIN only, the one who
 * manages keys; the others only read the event), a version event shows that version, an import filters to that user's recent changes. Other
 * events (and a deleted version) have none.
 */
const ActivityEventLink = ({ event, projectSlug, now }: ActivityEventLinkProps) => {
	const { t } = useTranslation()
	const { data: me } = useMeQuery()
	const link = (label: string, search: TranslationsSearch) => (
		<RowAction
			icon={ArrowRight}
			tooltip={t('dashboardPage.activity.open')}
			label={label}
			to='/projects/$projectSlug/translations'
			params={{ projectSlug }}
			search={search}
		/>
	)

	switch (event.type) {
		case ACTIVITY_TYPE.TRANSLATION_UPDATED: {
			const search = translationEditSearch(event)
			if (search) {
				return link(t('dashboardPage.activity.openKeyLabel', { key: event.payload.name }), search)
			}
			break
		}
		case ACTIVITY_TYPE.KEY_CREATED:
		case ACTIVITY_TYPE.KEY_UPDATED: {
			const { name, namespace } = event.payload
			if (name.length <= TRANSLATIONS_SEARCH_MAX_LENGTH && me?.role === ROLE.ADMIN) {
				return link(t('dashboardPage.activity.openKeyNameLabel', { key: name }), { search: name, namespace, version: event.version?.id })
			}
			break
		}
		case ACTIVITY_TYPE.VERSION_CREATED:
		case ACTIVITY_TYPE.VERSION_UPDATED:
			return event.version && link(t('dashboardPage.activity.openVersionLabel', { name: event.version.name }), { version: event.version.id })
	}
	const changedBy = event.type === ACTIVITY_TYPE.TRANSLATION_UPDATED || event.type === ACTIVITY_TYPE.KEYS_IMPORTED ? event.user : null
	return (
		changedBy &&
		link(t('dashboardPage.activity.openLabel', { name: changedBy.name }), {
			updatedBy: changedBy.id,
			updatedWithin: updatedWithinFor(event.createdAt, now),
		})
	)
}

export default ActivityEventLink
