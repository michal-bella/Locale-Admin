import { type ProjectVersion } from '@locale/shared'

export type ImportModalProps = {
	projectId: string
	/** Versions of the project for the Verzia step. */
	versions: ProjectVersion[]
	/** The version filtered on the page; preselected instead of the current one. */
	defaultVersionId?: string
	opened: boolean
	onClose: () => void
}

/** The chosen file, kept in memory: the preview is stateless and the import sends the same content again. */
export type SelectedImportFile = {
	name: string
	size: number
	content: string
}
