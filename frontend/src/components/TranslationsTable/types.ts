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
	/** Group header rows only make sense when the sort keeps a group together (not for `UPDATED`). */
	showGroups: boolean
}
