import { type TranslationsPageSize } from '@/routes/projectTranslationsRoute'

export type TranslationsPaginationProps<S extends number = TranslationsPageSize> = {
	page: number
	pageSize: number
	total: number
	shown: number
	onChange: (page: number) => void
	onPageSizeChange: (pageSize: S) => void
	/** Another list's page sizes and texts (História); left out, the keys of the translations list. */
	pageSizes?: readonly S[]
	summary?: string
	pageSizeLabel?: string
}
