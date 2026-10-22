import { type ProjectVersion } from '@locale/shared'

export type ExportModalProps = {
	projectId: string
	/** The version filtered on the page: the export is the project as of it, or only its work. */
	version?: ProjectVersion
	opened: boolean
	onClose: () => void
}
