/** Saves a Blob through a temporary link; the URL is revoked on the next task, after the browser has started the download. */
export const downloadFile = (blob: Blob, fileName: string) => {
	const url = URL.createObjectURL(blob)
	const link = document.createElement('a')
	link.href = url
	link.download = fileName
	document.body.append(link)
	link.click()
	link.remove()
	setTimeout(() => URL.revokeObjectURL(url), 0)
}
