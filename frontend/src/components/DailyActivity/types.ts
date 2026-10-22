export type DailyActivityProps = {
	projectId: string
	/** The version whose changes count; left out, the backend takes the current one. */
	versionId?: string
}
