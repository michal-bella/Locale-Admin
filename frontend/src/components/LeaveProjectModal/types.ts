export type LeaveProjectModalProps = {
	opened: boolean
	/** Kept after closing, so the text does not disappear during the close transition. */
	project: { id: string; name: string } | null
	onClose: () => void
	/** The user is no longer a member (left, or was not a member anymore). */
	onLeft: () => void
}
