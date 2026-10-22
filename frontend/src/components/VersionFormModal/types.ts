import { type ProjectVersion } from '@locale/shared'

export type VersionFormModalProps = {
	projectId: string
	opened: boolean
	/** The version to edit; `null` creates a new one. */
	version: ProjectVersion | null
	onClose: () => void
	/** Called with the new version after the modal closed (the import picks it). */
	onCreated?: (version: ProjectVersion) => void
	/** Above another modal (the import). */
	zIndex?: number
}
