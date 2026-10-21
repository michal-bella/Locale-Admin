export type TranslationTextProps = {
	value: string
	/** Also shows `#` (the number of an ICU plural form) as a chip. */
	pluralHash?: boolean
	/** Normalized placeholders of the base language; a chip outside the set gets a warning. `undefined` checks nothing. */
	basePlaceholders?: Set<string>
}
