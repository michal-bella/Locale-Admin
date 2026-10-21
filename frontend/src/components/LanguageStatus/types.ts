export type LanguageStatusProps = {
	projectId: string
	projectSlug: string
	/** Shows Spravovať jazyky; off for a VISITOR, who cannot open the Jazyky page. */
	manageable: boolean
}
