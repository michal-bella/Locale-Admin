import { type Language, type TranslationsLayout, type TranslationsResponse, type TranslationsView } from '@locale/shared'

export type TranslationsTableProps = {
	projectId: string
	data?: TranslationsResponse
	isPending: boolean
	isError: boolean
	error: unknown
	onRetry: () => Promise<boolean>
	isRetrying: boolean
	/** `EXTENDED`: a column per language with the key and status columns sticky; `COMPACT`: source and target columns. */
	view: TranslationsView
	/** `STACKED` puts the languages of the view under each other in one column and the status into the key cell. */
	layout: TranslationsLayout
	/** Languages of the extended view in column order (base first, always shown); the base one is the reference in `EditTranslationModal`. */
	languages: Language[]
	/** `undefined` only for a project without languages, which shows the empty state. */
	sourceLanguage?: Language
	targetLanguage?: Language
	onClearFilters: () => void
	/** Importovať in the empty state of a project without keys. */
	onImport: () => void
	/** Group header rows only make sense when the sort keeps a group together (not for `UPDATED`). */
	showGroups: boolean
	/** Hides the key and status columns, so the translations get the whole width. */
	translationsOnly?: boolean
	/** A VISITOR: cells are plain text and `EditTranslationModal` is not rendered. */
	readOnly?: boolean
	/** Opens Upraviť preklad of this key and language as soon as the list contains the key (a link from the activity on Prehľad). */
	openTranslationOf?: { keyId: string; language: Language }
	/** Saves the value of a key in a language; rejects with the API error (see `EditTranslationModal`). */
	onSave: (keyId: string, languageId: string, value: string | null) => Promise<unknown>
}
