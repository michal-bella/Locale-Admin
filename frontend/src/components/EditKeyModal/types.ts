import { type TranslationListItem } from '@locale/shared'

export type EditKeyModalProps = {
	projectId: string
	/** The key being edited; `null` while the modal is closed. */
	item: TranslationListItem | null
	opened: boolean
	onClose: () => void
}
