import { type TranslationListItem } from '@locale/shared'

export type EditKeyModalProps = {
	projectId: string
	/** The key being edited; `null` while the modal is closed. */
	item: TranslationListItem | null
	opened: boolean
	onClose: () => void
	/** A global ADMIN: renames the key and changes its plural forms. */
	canEditKey: boolean
	/** Every member who can write into the version (an ADMIN always, an EDITOR when it is not locked). */
	canEditDescription: boolean
}
