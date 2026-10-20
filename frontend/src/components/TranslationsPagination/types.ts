import { type TranslationsPageSize } from '@/routes/projectTranslationsRoute'

export type TranslationsPaginationProps = {
	page: number
	pageSize: number
	total: number
	shown: number
	onChange: (page: number) => void
	onPageSizeChange: (pageSize: TranslationsPageSize) => void
}
