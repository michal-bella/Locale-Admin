export type CountUpProps = {
	value: number
	/** Formats the whole number shown in each frame, e.g. as a share of all keys; plain digits without it. */
	format?: (value: number) => string
}
