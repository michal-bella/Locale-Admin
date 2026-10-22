import { type Language, type LanguageTag, type TranslationsLayout, type TranslationsView } from '@locale/shared'

import { type TranslationsSearch } from '@/routes/projectTranslationsRoute'

export type TranslationsViewControlsProps = {
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
	/** Called with the changed URL search params. */
	onChange: (patch: Partial<TranslationsSearch>) => void
}
