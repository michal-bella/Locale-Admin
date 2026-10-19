import { type Language, type TranslationsSort, type TranslationStatus, type TranslationsView } from '@locale/shared'

import { type TranslationsSearch } from '@/routes/projectTranslationsRoute'

export type TranslationsToolbarProps = {
	search?: string
	status?: TranslationStatus
	namespace?: string
	sort: TranslationsSort
	/** `EXTENDED` shows every language as a column, `COMPACT` the source → target pair with the two selects. */
	view: TranslationsView
	onViewChange: (view: TranslationsView) => void
	languages: Language[]
	sourceLanguage?: Language
	targetLanguage?: Language
	/** Every namespace of the project; the namespace filter shows only when there is more than one. */
	namespaces: string[]
	/** Called with the changed URL search params; the page resets the page number. */
	onChange: (patch: Partial<TranslationsSearch>) => void
}
