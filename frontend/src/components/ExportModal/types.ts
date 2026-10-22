import { type ProjectVersion } from '@locale/shared'

export type ExportModalProps = {
	projectId: string
	/** The version shown on the page; the file holds its keys. */
	version: ProjectVersion
	opened: boolean
	onClose: () => void
}
