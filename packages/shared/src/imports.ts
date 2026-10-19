import { z } from 'zod'

/** Limit of `content` in UTF-8 bytes. A larger body gets 413 `IMPORT_FILE_TOO_LARGE`. */
export const IMPORT_FILE_MAX_BYTES = 10 * 1024 * 1024

export const IMPORT_FILE_NAME_MAX_LENGTH = 255

/**
 * Limit of a key in UTF-8 bytes, not characters: the unique btree index on `(projectId, namespace, name)` holds at most
 * 2 704 bytes per row, and 2 000 Cyrillic characters take about 4 000.
 */
export const IMPORT_KEY_MAX_BYTES = 2000

/** A namespace is a JSON file name, so it is short; with the key it must fit in the same index row. */
export const IMPORT_NAMESPACE_MAX_LENGTH = 100

/** `IMPORT_FILE_INVALID` lists at most this many issues, `details.total` has the full count. */
export const IMPORT_ISSUES_MAX = 50

/** The preview lists at most this many warnings, `warningsTotal` has the full count. */
export const IMPORT_WARNINGS_MAX = 1000

/** Blocking problems of the file: the import is refused with 422 `IMPORT_FILE_INVALID`. */
export const IMPORT_ERROR_CODES = [
	'FILE_EMPTY',
	'FILE_NOT_UTF8',
	'HEADER_INVALID',
	'HEADER_EMPTY_TAG',
	'HEADER_DUPLICATE_TAG',
	'ROW_COLUMN_COUNT',
	'ROW_EMPTY_KEY',
	'ROW_DUPLICATE_KEY',
	'KEY_TOO_LONG',
	'NAMESPACE_INVALID',
] as const

/** Problems the user should see, the import can still run. */
export const IMPORT_WARNING_CODES = ['PLACEHOLDER_MISMATCH', 'LANGUAGE_NOT_IN_PROJECT', 'LANGUAGE_UNKNOWN', 'BASE_LANGUAGE_UNTRANSLATED'] as const

export const IMPORT_ISSUE_CODES = [...IMPORT_ERROR_CODES, ...IMPORT_WARNING_CODES] as const

export const importIssueCodeSchema = z.enum(IMPORT_ISSUE_CODES)

export type ImportIssueCode = z.infer<typeof importIssueCodeSchema>

/**
 * One finding in an imported file. The FE translates `code` with `params`, never shows server text.
 * `line` and `column` are 1-based positions in the file: line 1 is the header, column 1 is `Keys`.
 *
 * `params` by code: `ROW_COLUMN_COUNT` `{ expected, actual }`, `ROW_DUPLICATE_KEY` `{ key, namespace, firstLine }`,
 * `KEY_TOO_LONG` `{ max, length }` (UTF-8 bytes), `HEADER_DUPLICATE_TAG` `{ tag, firstColumn }`, `NAMESPACE_INVALID` `{ namespace }`,
 * `PLACEHOLDER_MISMATCH` `{ tag, key, namespace, missing, extra }` (placeholders joined by `, `),
 * `LANGUAGE_NOT_IN_PROJECT` and `LANGUAGE_UNKNOWN` `{ tag }`, `BASE_LANGUAGE_UNTRANSLATED` `{ tag, key, namespace }`.
 */
export const importIssueSchema = z.object({
	code: importIssueCodeSchema,
	line: z.number().int().min(1).optional(),
	column: z.number().int().min(1).optional(),
	params: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
})

export type ImportIssue = z.infer<typeof importIssueSchema>

/** `error.details` of 422 `IMPORT_FILE_INVALID`: the first `IMPORT_ISSUES_MAX` issues in file order and their total count. */
export const importFileInvalidDetailsSchema = z.object({
	issues: z.array(importIssueSchema),
	total: z.number().int().nonnegative(),
})

export type ImportFileInvalidDetails = z.infer<typeof importFileInvalidDetailsSchema>

/** Only CSV for now; the extension picks the parser. */
const importFileNameSchema = z
	.string()
	.trim()
	.min(1)
	.max(IMPORT_FILE_NAME_MAX_LENGTH)
	.regex(/\.csv$/i)

/** `content` is the file as text. Its size is checked by the backend in bytes (`IMPORT_FILE_MAX_BYTES`), not here. */
export const importPreviewRequestSchema = z.object({
	fileName: importFileNameSchema,
	content: z.string(),
})

export type ImportPreviewRequest = z.infer<typeof importPreviewRequestSchema>

/** `PROJECT`: the tag is a language of the project; `CATALOG`: in `SUPPORTED_LANGUAGES` only; `UNKNOWN`: neither. */
export const importColumnMatchSchema = z.enum(['PROJECT', 'CATALOG', 'UNKNOWN'])

export type ImportColumnMatch = z.infer<typeof importColumnMatchSchema>

const count = z.number().int().nonnegative()

/**
 * A language column of the file. `columnIndex` is its 1-based column (the first language is 2).
 * `languageId` is set only for `PROJECT`. `stats.translations` counts filled values, `untranslated` `null` and `""`,
 * `warnings` the warnings on this column.
 */
export const importPreviewColumnSchema = z.object({
	tag: z.string(),
	columnIndex: z.number().int().min(2),
	match: importColumnMatchSchema,
	languageId: z.uuid().optional(),
	stats: z.object({ translations: count, untranslated: count, warnings: count }),
})

export type ImportPreviewColumn = z.infer<typeof importPreviewColumnSchema>

/**
 * What an import would do to one `PROJECT` column. `new`: filled in the file, empty in the project; `changed`: both
 * filled and different (the import overwrites); `unchanged`: equal or both empty; `keptBecauseNull`: empty in the file,
 * filled in the project (the import keeps the project value).
 */
export const importPreviewChangesSchema = z.object({
	tag: z.string(),
	columnIndex: z.number().int().min(2),
	new: count,
	changed: count,
	unchanged: count,
	keptBecauseNull: count,
})

export type ImportPreviewChanges = z.infer<typeof importPreviewChangesSchema>

/** Body of `POST /api/projects/:projectId/imports/preview`. Keys are matched by `(namespace, name)`; nothing is written. */
export const importPreviewResponseSchema = z.object({
	columns: z.array(importPreviewColumnSchema),
	keys: z.object({ total: count, new: count, existing: count }),
	namespaces: z.array(z.object({ namespace: z.string(), keys: count })),
	changes: z.array(importPreviewChangesSchema),
	warnings: z.array(importIssueSchema),
	warningsTotal: count,
})

export type ImportPreviewResponse = z.infer<typeof importPreviewResponseSchema>

/**
 * Body of `POST /api/projects/:projectId/imports`. Every language column of the file is listed exactly once;
 * `languageId: null` skips it, a language of the project may be mapped to one column only, and at least one column must
 * be mapped (otherwise 400 `IMPORT_COLUMNS_INVALID`). `createMissingKeys: false` imports only values of keys the project
 * already has.
 */
export const importRequestSchema = importPreviewRequestSchema.extend({
	columns: z.array(z.object({ columnIndex: z.number().int().min(2), languageId: z.uuid().nullable() })).min(1),
	createMissingKeys: z.boolean().default(true),
})

export type ImportRequest = z.infer<typeof importRequestSchema>

export type ImportRequestInput = z.input<typeof importRequestSchema>

/**
 * Body of `200 POST /api/projects/:projectId/imports`. Counts match the preview: `translationsCreated` = `new`,
 * `translationsUpdated` = `changed`; `null` in the file never clears a filled value, so it is counted nowhere.
 */
export const importResultSchema = z.object({
	keysCreated: count,
	translationsCreated: count,
	translationsUpdated: count,
	skippedColumns: count,
})

export type ImportResult = z.infer<typeof importResultSchema>
