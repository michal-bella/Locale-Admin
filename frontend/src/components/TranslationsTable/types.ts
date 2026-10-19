import { type Language, type TranslationsResponse } from '@locale/shared'

export type TranslationsTableProps = {
	projectId: string
	data?: TranslationsResponse
	isPending: boolean
	isError: boolean
	error: unknown
	onRetry: () => Promise<boolean>
	isRetrying: boolean
	/** Every language of the project; the base one is the reference in `EditTranslationModal`. */
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
