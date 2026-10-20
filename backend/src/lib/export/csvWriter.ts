import { type ExportIssue, type ExportIssueCode } from '@locale/shared'

/** One key of the export with its values in the column order, `null` = untranslated. */
export type ExportRow = { keyId: string; namespace: string; key: string; values: (string | null)[] }

const NULL_VALUE = 'null'

/** Same regex `convert-csv-to-json` runs on every line to find a `--namespace--` section; it matches across fields too. */
const SECTION_MARKER_PATTERN = /(?<=--)(.*?)(?=--)/

/**
 * The CSV of GoodRequest i18nextJsonToCsv, byte for byte as `convert-json-to-csv` writes it and `parseCsv` reads it:
 * header `Keys; bg ; cs `, sections `--loc--`, rows ` key; value; null`, lines ending with `\n`, no quoting.
 */
export const csvHeader = (tags: string[]) => `Keys${tags.map((tag) => `; ${tag} `).join('')}\n`

export const csvSection = (namespace: string) => `--${namespace}--\n`

const csvLine = ({ key, values }: ExportRow) => ` ${key}${values.map((value) => `; ${value ?? NULL_VALUE}`).join('')}`

export const csvRow = (row: ExportRow) => `${csvLine(row)}\n`

const fieldIssue = (field: string): ExportIssueCode | null => {
	if (field.includes(';')) {
		return 'SEMICOLON'
	}
	return /[\r\n]/.test(field) ? 'LINE_BREAK' : null
}

/**
 * A namespace that `convert-csv-to-json` reads back differently from its section line: `a--b` becomes `a`, `x-` becomes `x`,
 * `-` is not a section at all. Reported once, on the first exported key of the namespace.
 */
export const namespaceIssue = (row: ExportRow): ExportIssue | null =>
	row.namespace !== '' && SECTION_MARKER_PATTERN.exec(csvSection(row.namespace))?.[0] !== row.namespace
		? { code: 'NAMESPACE', keyId: row.keyId, namespace: row.namespace, key: row.key, languageTag: null }
		: null

/** Everything in the row that would break the file for `convert-csv-to-json`; `tags` are the languages of `values`. */
export const rowIssues = (row: ExportRow, tags: string[]): ExportIssue[] => {
	const issue = (code: ExportIssueCode, languageTag: string | null): ExportIssue => ({
		code,
		keyId: row.keyId,
		namespace: row.namespace,
		key: row.key,
		languageTag,
	})
	const issues: ExportIssue[] = []
	const keyCode = fieldIssue(row.key)
	if (keyCode) {
		issues.push(issue(keyCode, null))
	}
	row.values.forEach((value, index) => {
		const code = value === null ? null : fieldIssue(value)
		if (code) {
			issues.push(issue(code, tags[index] ?? null))
		}
	})
	if (issues.length === 0 && (SECTION_MARKER_PATTERN.exec(csvLine(row))?.[0] ?? '') !== '') {
		issues.push(issue('SECTION_MARKER', null))
	}
	return issues
}
