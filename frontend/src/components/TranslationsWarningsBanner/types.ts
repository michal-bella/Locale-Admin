export type TranslationsWarningsBannerProps = {
	/** Keys of the project with at least one placeholder warning (`stats.warnings`). */
	count: number
	/** The `warnings` filter is on: the banner offers to clear it instead of turning it on. */
	active: boolean
	onShow: () => void
	onClear: () => void
}
