import { type Language, type TranslationsResponse } from '@locale/shared'

export type TranslationsTableProps = {
	data?: TranslationsResponse
	isPending: boolean
	isError: boolean
	error: unknown
	onRetry: () => Promise<boolean>
	isRetrying: boolean
	/** `undefined` only for a project without languages, which shows the empty state. */
	sourceLanguage?: Language
	targetLanguage?: Language
	onClearFilters: () => void
	/** Importovať in the empty state of a project without keys. */
	onImport: () => void
	/** Group header rows only make sense when the sort keeps a group together (not for `UPDATED`). */
	showGroups: boolean
	/** Saves the target value of a key; rejects with the API error (see `TranslationEditor`). */
	onSave: (keyId: string, value: string | null) => Promise<unknown>
}
