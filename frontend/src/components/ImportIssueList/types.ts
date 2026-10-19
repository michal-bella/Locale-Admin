import { type ImportIssue } from '@locale/shared'

export type ImportIssueListProps = {
	title: string
	/** Issues in file order, already capped by the backend. */
	issues: ImportIssue[]
	/** Total count; when larger than `issues.length` the list ends with „a ďalších N“. */
	total: number
	tone: 'error' | 'warning'
}
