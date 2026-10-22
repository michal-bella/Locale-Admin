import { type ProjectVersion, type TranslationEditor, type TranslationsSort, type TranslationStatus, type TranslationsUpdatedWithin } from '@locale/shared'

import { type TranslationsSearch } from '@/routes/projectTranslationsRoute'

export type TranslationsToolbarProps = {
	search?: string
	status?: TranslationStatus
	namespace?: string
	sort: TranslationsSort
	updatedBy?: string
	updatedWithin?: TranslationsUpdatedWithin
	/** The version the list shows (the current one by default); `undefined` is the whole project. */
	version?: string
	/** Versions of the project, newest first; the Verzia filter shows only when there is at least one. */
	versions: ProjectVersion[]
	/** Members of the project and other users who changed one of its translations, most edits first, for the Editor filter. */
	editors: TranslationEditor[]
	/** Every namespace of the project; the namespace filter shows only when there is more than one. */
	namespaces: string[]
	/** Called with the changed URL search params; the page resets the page number. */
	onChange: (patch: Partial<TranslationsSearch>) => void
}
