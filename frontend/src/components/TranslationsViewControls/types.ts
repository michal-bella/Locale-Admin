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
	/** Hides the key and status columns of the table. */
	translationsOnly?: true
	/** Lists only the keys added or changed against the previous version (Zobraziť len zmeny). */
	diffOnly?: true
	/** The version has an import, so it has a diff; without one the switch is not shown. */
	diffAvailable: boolean
	/** Called with the changed URL search params. */
	onChange: (patch: Partial<TranslationsSearch>) => void
}
