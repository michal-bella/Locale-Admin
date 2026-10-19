import { IMPORT_ISSUES_MAX, IMPORT_KEY_MAX_BYTES, IMPORT_NAMESPACE_MAX_LENGTH, type ImportIssue } from '@locale/shared'

import { type ParseResult, type ParsedColumn, type ParsedRow } from './parsedFile'

const HEADER_KEYS = 'Keys'
const SEPARATOR = '; '
const SECTION_PATTERN = /^--([^;]*)--$/

/** A namespace becomes a file name (`<tag>/<namespace>.json`) in the export, so only safe file names are allowed. */
export const NAMESPACE_PATTERN = /^[A-Za-z0-9._-]+$/

/** U+FFFD is what a lenient UTF-8 decoder puts in place of invalid bytes; a lone surrogate cannot be encoded at all. */
const NOT_UTF8_PATTERN = /\uFFFD|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/

const isValidNamespace = (namespace: string) =>
	NAMESPACE_PATTERN.test(namespace) && namespace !== '.' && namespace !== '..' && namespace.length <= IMPORT_NAMESPACE_MAX_LENGTH

const toValue = (field: string): string | null => (field === 'null' || field === '""' || field === '' ? null : field)

const splitFields = (text: string) => text.split(SEPARATOR).map((field) => field.trim())

/** An editor that strips trailing spaces turns a last empty field `; ` into `;`. Only then, so `&nbsp;` at the end of a value survives. */
const splitRow = (text: string, expected: number) => {
	const fields = splitFields(text)
	const last = fields.at(-1)
	if (fields.length === expected - 1 && last?.endsWith(';')) {
		fields[fields.length - 1] = last.slice(0, -1).trim()
		fields.push('')
	}
	return fields
}

const fail = (issues: ImportIssue[]): ParseResult => ({ ok: false, issues: issues.slice(0, IMPORT_ISSUES_MAX), total: issues.length })

/**
 * Parses the CSV of GoodRequest i18nextJsonToCsv: header `Keys; bg ; cs ; …` and rows ` key; value; value`, both separated by `; `
 * without quoting, lines by `\r\n`, `\r` or `\n`, sections `--namespace--`. Every field is trimmed, `null` and `""` become `null`, blank lines are skipped.
 * Header issues stop parsing because the rows cannot be interpreted without the header.
 */
export const parseCsv = (content: string): ParseResult => {
	const lines = (content.startsWith('\uFEFF') ? content.slice(1) : content).split(/\r\n|\r|\n/)

	const encodingIssues: ImportIssue[] = []
	lines.forEach((line, index) => {
		if (NOT_UTF8_PATTERN.test(line)) {
			encodingIssues.push({ code: 'FILE_NOT_UTF8', line: index + 1 })
		}
	})
	if (encodingIssues.length > 0) {
		return fail(encodingIssues)
	}

	const headerIndex = lines.findIndex((line) => line.trim() !== '')
	const headerText = lines[headerIndex]
	if (headerText === undefined) {
		return fail([{ code: 'FILE_EMPTY' }])
	}
	const headerLine = headerIndex + 1
	const header = splitFields(headerText)
	if (header[0] !== HEADER_KEYS || header.length < 2) {
		return fail([{ code: 'HEADER_INVALID', line: headerLine, column: 1 }])
	}

	const headerIssues: ImportIssue[] = []
	const columns: ParsedColumn[] = []
	const firstColumnByTag = new Map<string, number>()
	header.slice(1).forEach((tag, index) => {
		const columnIndex = index + 2
		const firstColumn = firstColumnByTag.get(tag.toLowerCase())
		if (tag === '') {
			headerIssues.push({ code: 'HEADER_EMPTY_TAG', line: headerLine, column: columnIndex })
		} else if (firstColumn !== undefined) {
			headerIssues.push({ code: 'HEADER_DUPLICATE_TAG', line: headerLine, column: columnIndex, params: { tag, firstColumn } })
		} else {
			firstColumnByTag.set(tag.toLowerCase(), columnIndex)
			columns.push({ tag, columnIndex })
		}
	})
	if (headerIssues.length > 0) {
		return fail(headerIssues)
	}

	const issues: ImportIssue[] = []
	const rows: ParsedRow[] = []
	const firstLineByKey = new Map<string, number>()
	let namespace = ''
	let dataLines = 0
	lines.slice(headerIndex + 1).forEach((text, index) => {
		const line = headerLine + index + 1
		const trimmed = text.trim()
		if (trimmed === '') {
			return
		}
		const section = SECTION_PATTERN.exec(trimmed)
		if (section) {
			namespace = section[1] ?? ''
			if (!isValidNamespace(namespace)) {
				issues.push({ code: 'NAMESPACE_INVALID', line, params: { namespace } })
			}
			return
		}

		dataLines += 1
		const fields = splitRow(text, header.length)
		if (fields.length !== header.length) {
			issues.push({ code: 'ROW_COLUMN_COUNT', line, params: { expected: header.length, actual: fields.length } })
			return
		}
		const [key = '', ...values] = fields
		if (key === '') {
			issues.push({ code: 'ROW_EMPTY_KEY', line, column: 1 })
			return
		}
		const length = Buffer.byteLength(key, 'utf8')
		if (length > IMPORT_KEY_MAX_BYTES) {
			issues.push({ code: 'KEY_TOO_LONG', line, column: 1, params: { max: IMPORT_KEY_MAX_BYTES, length } })
			return
		}
		const identity = `${namespace}\u0000${key}`
		const firstLine = firstLineByKey.get(identity)
		if (firstLine !== undefined) {
			issues.push({ code: 'ROW_DUPLICATE_KEY', line, column: 1, params: { key, namespace, firstLine } })
			return
		}
		firstLineByKey.set(identity, line)
		rows.push({ line, namespace, key, values: values.map(toValue) })
	})

	if (dataLines === 0) {
		issues.push({ code: 'FILE_EMPTY' })
	}
	if (issues.length > 0) {
		return fail(issues)
	}
	return { ok: true, file: { headerLine, columns, rows } }
}
