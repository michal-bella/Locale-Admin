import { type ProjectVersion } from '@locale/shared'

export type VersionFormModalProps = {
	projectId: string
	opened: boolean
	/** The version to edit; `null` creates a new one. */
	version: ProjectVersion | null
	onClose: () => void
}
