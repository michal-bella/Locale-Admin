import { type ImportIssue } from '@locale/shared'

/** A language column of the file; `columnIndex` is 1-based (column 1 holds the keys, so the first language is 2). */
export type ParsedColumn = { tag: string; columnIndex: number }

/** One key of the file. `values[i]` belongs to `columns[i]`; `null` is untranslated (`null` or `""` in the file). */
export type ParsedRow = { line: number; namespace: string; key: string; values: (string | null)[] }

/** Format-neutral result of every import parser (CSV now, JSON and XLSX later). Rows are in file order. */
export type ParsedFile = { headerLine: number; columns: ParsedColumn[]; rows: ParsedRow[] }

/** `issues` holds the first `IMPORT_ISSUES_MAX` blocking issues in file order, `total` their full count. */
export type ParseResult = { ok: true; file: ParsedFile } | { ok: false; issues: ImportIssue[]; total: number }
