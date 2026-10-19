import { type AdminUserDetail, type AdminUserProject } from '@locale/shared'

export type RemoveUserProjectModalProps = {
	user: AdminUserDetail
	opened: boolean
	/** Kept after closing, so the text does not disappear during the close transition. */
	project: AdminUserProject | null
	onClose: () => void
	/** The membership is gone (removed, or already removed by someone else). */
	onRemoved: () => void
}
