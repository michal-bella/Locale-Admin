import {
	type Language,
	type LanguageTag,
	type TranslationEditor,
	type TranslationsLayout,
	type TranslationsSort,
	type TranslationStatus,
	type TranslationsUpdatedWithin,
	type TranslationsView,
} from '@locale/shared'

import { type TranslationsSearch } from '@/routes/projectTranslationsRoute'

export type TranslationsToolbarProps = {
	search?: string
	status?: TranslationStatus
	namespace?: string
	sort: TranslationsSort
	/** `EXTENDED` shows every language as a column, `COMPACT` the source → target pair with the two selects. */
	view: TranslationsView
	onViewChange: (view: TranslationsView) => void
	/** While a preference (view or layout) saves, so two quick switches cannot race. */
	isPreferenceSaving?: boolean
	/** Languages of the view side by side or stacked in one column. */
	layout: TranslationsLayout
	onLayoutChange: (layout: TranslationsLayout) => void
	languages: Language[]
	sourceLanguage?: Language
	targetLanguage?: Language
	/** Non-base languages the extended view shows next to the base one; `undefined` shows every language. */
	shownLanguages?: LanguageTag[]
	updatedBy?: string
	updatedWithin?: TranslationsUpdatedWithin
	/** Hides the key and status columns of the table. */
	translationsOnly?: true
	/** Members of the project and other users who changed one of its translations, most edits first, for the Editor filter. */
	editors: TranslationEditor[]
	/** Every namespace of the project; the namespace filter shows only when there is more than one. */
	namespaces: string[]
	/** Called with the changed URL search params; the page resets the page number. */
	onChange: (patch: Partial<TranslationsSearch>) => void
}
