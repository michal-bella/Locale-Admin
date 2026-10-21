export type TranslationValueProps = {
	value: string | null
	/** Set for a plural key: BCP 47 tag of the language whose forms are stacked. */
	pluralTag?: string
	/**
	 * Text whose placeholders the value must keep (the base language value, or the key name when it has placeholders and the base is empty,
	 * as the API checks it). A chip outside it gets a warning, placeholders the value lacks a warning icon after it. `undefined` checks nothing.
	 */
	reference?: string
}
