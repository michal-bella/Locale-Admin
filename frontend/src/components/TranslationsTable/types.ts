import { type Language, type TranslationsResponse, type TranslationsView } from '@locale/shared'

import { type TranslationsLayout } from '@/routes/projectTranslationsRoute'

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
	/** Compact view only: `STACKED` puts the source and target under each other in one column and the status into the key cell. */
	layout: TranslationsLayout
	/** Every language of the project in column order (base first); the base one is the reference in `EditTranslationModal`. */
	languages: Language[]
	/** `undefined` only for a project without languages, which shows the empty state. */
	sourceLanguage?: Language
	targetLanguage?: Language
	onClearFilters: () => void
	/** Importovať in the empty state of a project without keys. */
	onImport: () => void
	/** Group header rows only make sense when the sort keeps a group together (not for `UPDATED`). */
	showGroups: boolean
	/** Saves the value of a key in a language; rejects with the API error (see `EditTranslationModal`). */
	onSave: (keyId: string, languageId: string, value: string | null) => Promise<unknown>
}
