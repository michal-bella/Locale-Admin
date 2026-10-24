export type TranslationDiffProps = {
	oldValue: string
	newValue: string
	/** Language of both values; their words are split by its rules. */
	languageTag: string
	/** `before` shows the old value with the removed parts marked, `after` the new one with the added parts. */
	side: 'before' | 'after'
}
