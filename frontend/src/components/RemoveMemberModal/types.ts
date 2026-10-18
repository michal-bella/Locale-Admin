import { type ProjectMember } from '@locale/shared'

export type RemoveMemberModalProps = {
	projectId: string
	opened: boolean
	/** Kept after closing, so the text does not disappear during the close transition. */
	member: ProjectMember | null
	onClose: () => void
	/** The member is gone (removed, or already removed by someone else). */
	onRemoved: () => void
}
