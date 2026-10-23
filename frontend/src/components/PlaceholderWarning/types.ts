export type PlaceholderWarningProps = {
	/** Placeholders of the base language the value lacks. */
	missing: string[]
	/** Placeholders the value has and the base language does not. */
	extra: string[]
	/** `false` inside a table cell, whose own tooltip carries the message. */
	tooltip?: boolean
}
