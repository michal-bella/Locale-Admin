import { type AdminProjectListItem } from '@locale/shared'

export type EditProjectModalProps = {
	opened: boolean
	/** Kept after closing, so the content does not disappear during the close transition. */
	project: AdminProjectListItem | null
	onClose: () => void
}
