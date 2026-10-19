const KILOBYTE = 1024

/** `12 kB` under 1 MB, otherwise `1,5 MB`, in the given UI language. */
export const formatFileSize = (bytes: number, locale: string) => {
	const megabytes = bytes / KILOBYTE / KILOBYTE
	if (megabytes >= 1) {
		return new Intl.NumberFormat(locale, { style: 'unit', unit: 'megabyte', maximumFractionDigits: 1 }).format(megabytes)
	}
	return new Intl.NumberFormat(locale, { style: 'unit', unit: 'kilobyte', maximumFractionDigits: 0 }).format(Math.max(1, bytes / KILOBYTE))
}
