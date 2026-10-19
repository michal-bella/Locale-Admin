export type ImportDropzoneProps = {
	/** Name and size of the chosen file, `null` before a choice. */
	file: { name: string; size: number } | null
	onSelect: (file: File) => void
	disabled?: boolean
	/** Text under the dropzone (type or size rejected locally), also linked via `aria-describedby`. */
	error?: string
}
