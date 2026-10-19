export type TranslationsPaginationProps = {
	page: number
	pageSize: number
	total: number
	shown: number
	onChange: (page: number) => void
}
