export type ImportModalProps = {
	projectId: string
	opened: boolean
	onClose: () => void
}

/** The chosen file, kept in memory: the preview is stateless and the import sends the same content again. */
export type SelectedImportFile = {
	name: string
	size: number
	content: string
}
