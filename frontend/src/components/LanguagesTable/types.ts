import { type Language } from '@locale/shared'

export type LanguagesTableProps = {
	onAdd: () => void
	onEdit: (language: Language) => void
	onDelete: (language: Language) => void
}
