import { type ProjectVersion } from '@locale/shared'

export type VersionLockModalProps = {
	projectId: string
	opened: boolean
	/** A locked version gets unlocked, an unlocked one locked. */
	version: ProjectVersion | null
	onClose: () => void
}
