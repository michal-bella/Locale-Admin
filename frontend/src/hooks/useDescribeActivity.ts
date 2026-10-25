import { useTranslation } from 'react-i18next'

import { ACTIVITY_TYPE, type ActivityEvent, type ActivityMember } from '@locale/shared'

import { toIntlLocale } from '@/lib/formatDate'
import { isLanguageTag } from '@/lib/utils'

const memberName = ({ firstName, lastName, email }: ActivityMember) => [firstName, lastName].filter(Boolean).join(' ') || email

/** The sentence of an activity event („úprava prekladu … (bulharčina)“), built from its type and payload snapshot, never from the API. */
export const useDescribeActivity = () => {
	const { t, i18n } = useTranslation()

	const languageName = (tag: string) => (isLanguageTag(tag) ? t(`languageNames.${tag}`) : tag)
	const list = (items: string[]) => new Intl.ListFormat(toIntlLocale(i18n.language), { type: 'conjunction' }).format(items)

	const describe = (event: ActivityEvent): string => {
		switch (event.type) {
			case ACTIVITY_TYPE.PROJECT_CREATED:
				return t('dashboardPage.activity.events.projectCreated', { name: event.payload.name })
			case ACTIVITY_TYPE.PROJECT_UPDATED:
				return t('dashboardPage.activity.events.projectUpdated', {
					fields: list(event.payload.fields.map((field) => t(`dashboardPage.activity.projectFields.${field}`))),
				})
			case ACTIVITY_TYPE.LANGUAGE_ADDED:
				return t('dashboardPage.activity.events.languageAdded', { language: languageName(event.payload.tag) })
			case ACTIVITY_TYPE.LANGUAGE_REMOVED:
				return t('dashboardPage.activity.events.languageRemoved', { language: languageName(event.payload.tag) })
			case ACTIVITY_TYPE.BASE_LANGUAGE_CHANGED:
				return event.payload.fromTag === null
					? t('dashboardPage.activity.events.baseLanguageSet', { to: languageName(event.payload.toTag) })
					: t('dashboardPage.activity.events.baseLanguageChanged', {
							from: languageName(event.payload.fromTag),
							to: languageName(event.payload.toTag),
						})
			case ACTIVITY_TYPE.MEMBER_ADDED:
				return t('dashboardPage.activity.events.memberAdded', { member: memberName(event.payload.member) })
			case ACTIVITY_TYPE.MEMBER_REMOVED:
				return event.payload.left
					? t('dashboardPage.activity.events.memberLeft')
					: t('dashboardPage.activity.events.memberRemoved', { member: memberName(event.payload.member) })
			case ACTIVITY_TYPE.MEMBER_ROLE_CHANGED:
				return t('dashboardPage.activity.events.memberRoleChanged', {
					member: memberName(event.payload.member),
					from: t(`roles.${event.payload.fromRole}`),
					to: t(`roles.${event.payload.toRole}`),
				})
			case ACTIVITY_TYPE.KEYS_IMPORTED: {
				const { keysCreated, keysCopied = 0, keysRemoved = 0, translationsCreated, translationsUpdated } = event.payload
				const translationCount = translationsCreated + translationsUpdated
				const parts = translationCount > 0 ? [t('dashboardPage.activity.events.translationCount', { count: translationCount })] : []
				if (keysCreated > 0) {
					parts.push(t('dashboardPage.activity.events.newKeyCount', { count: keysCreated }))
				}
				// An import into a new version can only copy the keys of the previous one; it still says what it did.
				if (keysCopied > 0) {
					parts.push(t('dashboardPage.activity.events.copiedKeyCount', { count: keysCopied }))
				}
				if (keysRemoved > 0) {
					parts.push(t('dashboardPage.activity.events.removedKeyCount', { count: keysRemoved }))
				}
				return t('dashboardPage.activity.events.keysImported', {
					changes: parts.length > 0 ? list(parts) : t('dashboardPage.activity.events.noChanges'),
				})
			}
			case ACTIVITY_TYPE.KEY_CREATED:
				return t('dashboardPage.activity.events.keyCreated', { key: event.payload.name })
			case ACTIVITY_TYPE.KEY_UPDATED:
				return t('dashboardPage.activity.events.keyUpdated', {
					key: event.payload.name,
					fields: list(event.payload.fields.map((field) => t(`dashboardPage.activity.keyFields.${field}`))),
				})
			case ACTIVITY_TYPE.TRANSLATION_UPDATED:
				return t('dashboardPage.activity.events.translationUpdated', { key: event.payload.name, language: languageName(event.payload.languageTag) })
			case ACTIVITY_TYPE.VERSION_CREATED:
				return t('dashboardPage.activity.events.versionCreated', { name: event.payload.name })
			case ACTIVITY_TYPE.VERSION_UPDATED:
				return t('dashboardPage.activity.events.versionUpdated', {
					name: event.payload.name,
					fields: list(event.payload.fields.map((field) => t(`dashboardPage.activity.versionFields.${field}`))),
				})
			case ACTIVITY_TYPE.VERSION_DELETED:
				return t('dashboardPage.activity.events.versionDeleted', { name: event.payload.name, count: event.payload.keyCount })
		}
	}

	return describe
}
