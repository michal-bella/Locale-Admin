import { CsvError, parse } from 'csv-parse/sync'

import { IMPORT_ISSUES_MAX, IMPORT_KEY_MAX_BYTES, IMPORT_NAMESPACE_MAX_LENGTH, type ImportIssue } from '@locale/shared'

import { type ParseResult, type ParsedColumn, type ParsedRow } from './parsedFile'

const KEY_COLUMN_PATTERN = /^keys?$/i
/** The header picks the separator: the first `;`, `,` or tab after the key column; `; ` (with the space) is the i18nextJsonToCsv format. */
const HEADER_PATTERN = /^\s*"?keys?"?\s*([;,\t])( ?)/i
const LEGACY_SEPARATOR = '; '
const SECTION_PATTERN = /^--([^;]*)--$/

/** A namespace becomes a file name (`<tag>/<namespace>.json`) in the export, so only safe file names are allowed. */
export const NAMESPACE_PATTERN = /^[A-Za-z0-9._-]+$/

/** U+FFFD is what a lenient UTF-8 decoder puts in place of invalid bytes; a lone surrogate cannot be encoded at all. */
const NOT_UTF8_PATTERN = /\uFFFD|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/

const isValidNamespace = (namespace: string) =>
	NAMESPACE_PATTERN.test(namespace) && namespace !== '.' && namespace !== '..' && namespace.length <= IMPORT_NAMESPACE_MAX_LENGTH

const toValue = (field: string): string | null => (field === 'null' || field === '""' || field === '' ? null : field)

/** An editor that strips trailing spaces turns a last empty field `; ` into `;`. Only then, so `&nbsp;` at the end of a value survives. */
const fixTrailingSeparator = (fields: string[], expected: number) => {
	const last = fields.at(-1)
	if (fields.length === expected - 1 && last?.endsWith(';')) {
		return [...fields.slice(0, -1), last.slice(0, -1).trim(), '']
	}
	return fields
}

type CsvRecord = { line: number; fields: string[] }

type ReadResult = { ok: true; records: CsvRecord[] } | { ok: false; line: number }

/**
 * Reads the records with csv-parse. The i18nextJsonToCsv format has no quoting, so `""` stays a literal null marker.
 * Column counts and stray quotes are relaxed because the rows are checked here with line numbers.
 * Empty lines stay records, so a record starts on the line after the previous one ends (`context.lines` is the last line of a record).
 */
const readRecords = (text: string, separator: string, legacy: boolean, firstLine: number): ReadResult => {
	const records: CsvRecord[] = []
	let nextLine = firstLine
	try {
		parse(text, {
			delimiter: legacy ? LEGACY_SEPARATOR : separator,
			quote: !legacy,
			record_delimiter: '\n',
			trim: true,
			relax_column_count: true,
			relax_quotes: true,
			on_record: (fields: string[], context) => {
				records.push({ line: nextLine, fields })
				nextLine = firstLine + context.lines
				return null
			},
		})
	} catch (error) {
		if (error instanceof CsvError && error.code === 'CSV_QUOTE_NOT_CLOSED') {
			return { ok: false, line: nextLine }
		}
		throw error
	}
	return { ok: true, records }
}

const fail = (issues: ImportIssue[]): ParseResult => ({ ok: false, issues: issues.slice(0, IMPORT_ISSUES_MAX), total: issues.length })

/**
 * Parses two CSV flavours, told apart by the header:
 * - GoodRequest i18nextJsonToCsv: header `Keys; bg ; cs ; …` and rows ` key; value; value`, separated by `; ` without quoting;
 * - a spreadsheet export (Excel, Google Sheets): header `key;cs;sk` separated by `;`, `,` or tab, RFC 4180 quoting.
 * The key column is `key` or `Keys` in any case. Lines end with `\r\n`, `\r` or `\n`, a row `--namespace--` starts a section.
 * Fields are trimmed outside quotes, `null` and `""` become `null`, rows with only empty fields are skipped.
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
	const separator = HEADER_PATTERN.exec(headerText)
	if (!separator?.[1]) {
		return fail([{ code: 'HEADER_INVALID', line: headerLine, column: 1 }])
	}
	const legacy = separator[1] === ';' && separator[2] === ' '
	const read = readRecords(lines.slice(headerIndex).join('\n'), separator[1], legacy, headerLine)
	if (!read.ok) {
		return fail([{ code: 'ROW_UNCLOSED_QUOTE', line: read.line }])
	}
	const [headerRecord, ...records] = read.records
	const header = headerRecord?.fields ?? []
	if (!KEY_COLUMN_PATTERN.test(header[0] ?? '') || header.length < 2) {
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
	records.forEach((record) => {
		const { line } = record
		if (record.fields.every((field) => field === '')) {
			return
		}
		const section = record.fields.slice(1).every((field) => field === '') ? SECTION_PATTERN.exec(record.fields[0] ?? '') : null
		if (section) {
			namespace = section[1] ?? ''
			if (!isValidNamespace(namespace)) {
				issues.push({ code: 'NAMESPACE_INVALID', line, params: { namespace } })
			}
			return
		}

		dataLines += 1
		const fields = legacy ? fixTrailingSeparator(record.fields, header.length) : record.fields
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
