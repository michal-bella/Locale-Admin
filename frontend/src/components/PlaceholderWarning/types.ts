export type PlaceholderWarningProps = {
	/** Placeholders of the base language the value lacks. */
	missing: string[]
	/** Placeholders the value has and the base language does not. */
	extra: string[]
}
