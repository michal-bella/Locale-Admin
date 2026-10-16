export type ErrorPageProps = {
	error: unknown
	/** Rendered inside `AppLayout` (the top bar already shows the brand), so no `CenteredLayout`. */
	inAppLayout?: boolean
}
