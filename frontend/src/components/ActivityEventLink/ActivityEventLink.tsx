import { useTranslation } from 'react-i18next'

import { ACTIVITY_TYPE, TRANSLATIONS_SEARCH_MAX_LENGTH, type TranslationsUpdatedWithin } from '@locale/shared'

import { ArrowRight } from '@/components/Icons'
import RowAction from '@/components/RowAction/RowAction'
import { isLanguageTag } from '@/lib/utils'

import { type ActivityEventLinkProps } from './types'

const DAY_MS = 24 * 60 * 60 * 1000

/** The shortest `updatedWithin` of Preklady that still reaches back to the event; older events filter by the user only. */
const updatedWithinFor = (createdAt: string, now: Date): TranslationsUpdatedWithin | undefined => {
	const age = now.getTime() - new Date(createdAt).getTime()
	return age < DAY_MS ? 'DAY' : age < 7 * DAY_MS ? 'WEEK' : age < 30 * DAY_MS ? 'MONTH' : undefined
}

/** The → of an activity row: an edit opens its translation, an import Preklady filtered to that user's recent changes; other events have none. */
const ActivityEventLink = ({ event, projectSlug, now }: ActivityEventLinkProps) => {
	const { t } = useTranslation()
	const changedBy = event.type === ACTIVITY_TYPE.TRANSLATION_UPDATED || event.type === ACTIVITY_TYPE.KEYS_IMPORTED ? event.user : null
	// The key, not the editor filter: that one matches the last editor, so a later edit by someone else would hide the row.
	const editedKey = event.type === ACTIVITY_TYPE.TRANSLATION_UPDATED && event.payload.name.length <= TRANSLATIONS_SEARCH_MAX_LENGTH ? event.payload : null

	if (editedKey) {
		return (
			<RowAction
				icon={ArrowRight}
				tooltip={t('dashboardPage.activity.open')}
				label={t('dashboardPage.activity.openKeyLabel', { key: editedKey.name })}
				to='/projects/$projectSlug/translations'
				params={{ projectSlug }}
				search={{
					search: editedKey.name,
					namespace: editedKey.namespace,
					version: event.version?.id,
					editKey: editedKey.keyId,
					editLanguage: isLanguageTag(editedKey.languageTag) ? editedKey.languageTag : undefined,
				}}
			/>
		)
	}
	if (!changedBy) {
		return null
	}
	return (
		<RowAction
			icon={ArrowRight}
			tooltip={t('dashboardPage.activity.open')}
			label={t('dashboardPage.activity.openLabel', { name: changedBy.name })}
			to='/projects/$projectSlug/translations'
			params={{ projectSlug }}
			search={{ updatedBy: changedBy.id, updatedWithin: updatedWithinFor(event.createdAt, now) }}
		/>
	)
}

export default ActivityEventLink
