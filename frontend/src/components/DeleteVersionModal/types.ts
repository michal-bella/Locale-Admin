import { type ProjectVersion } from '@locale/shared'

export type DeleteVersionModalProps = {
	projectId: string
	opened: boolean
	/** Kept after closing, so the text does not disappear during the close transition. */
	version: ProjectVersion | null
	onClose: () => void
}
