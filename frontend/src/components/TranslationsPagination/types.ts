export type TranslationsPaginationProps = {
	page: number
	pageSize: number
	total: number
	/** Rows on the current page. */
	shown: number
	onChange: (page: number) => void
}
