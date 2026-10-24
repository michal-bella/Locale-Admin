import { type ACTIVITY_TYPE, type ActivityEvent, TRANSLATIONS_SEARCH_MAX_LENGTH } from '@locale/shared'

import { isLanguageTag } from '@/lib/utils'
import { type TranslationsSearch } from '@/routes/projectTranslationsRoute'

/**
 * Search of Preklady that shows the key of a translation edit in its version and opens Upraviť preklad on the edited language; `undefined`
 * for a key name too long for the search box. It filters by the key, not the editor: that one matches the last editor, so a later edit by
 * someone else would hide the row.
 */
export const translationEditSearch = (event: Extract<ActivityEvent, { type: ACTIVITY_TYPE.TRANSLATION_UPDATED }>): TranslationsSearch | undefined => {
	const { name, namespace, keyId, languageTag } = event.payload
	if (name.length > TRANSLATIONS_SEARCH_MAX_LENGTH) {
		return undefined
	}
	return { search: name, namespace, version: event.version?.id, editKey: keyId, editLanguage: isLanguageTag(languageTag) ? languageTag : undefined }
}
