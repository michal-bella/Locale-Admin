import { type TFunction } from 'i18next'

import { type ImportIssue } from '@locale/shared'

const EMPTY_PLACEHOLDER_LIST = '–'

/** One sentence for an issue of an imported file: the position („Riadok 812: “) and the translated code with its params. */
export const formatImportIssue = (t: TFunction, issue: ImportIssue) => {
	const params = Object.fromEntries(Object.entries(issue.params ?? {}).map(([key, value]) => [key, value === '' ? EMPTY_PLACEHOLDER_LIST : value]))
	const message = t(`importIssues.${issue.code}`, params)
	if (issue.line === undefined) {
		return message
	}
	const position =
		issue.column === undefined
			? t('importModal.issues.line', { line: issue.line })
			: t('importModal.issues.lineColumn', { line: issue.line, column: issue.column })
	return `${position}: ${message}`
}
