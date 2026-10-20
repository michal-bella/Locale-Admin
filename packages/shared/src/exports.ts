import { z } from 'zod'

import { SUPPORTED_LANGUAGES } from './languages'

/** Only CSV for now; JSON, XLSX and ARB come later. */
export const exportFormatSchema = z.enum(['CSV'])

export type ExportFormat = z.infer<typeof exportFormatSchema>

/**
 * Judged per key over the exported languages: `TRANSLATED` keeps keys with a value in every one of them,
 * `UNTRANSLATED` keys missing at least one. Untranslated cells of a kept key are written as `null`.
 */
export const exportStatusSchema = z.enum(['ALL', 'TRANSLATED', 'UNTRANSLATED'])

export type ExportStatus = z.infer<typeof exportStatusSchema>

/** File name the server sends; the user can rename it in the export modal. */
export const EXPORT_FILE_NAME_DEFAULT = 'translations'

/** The export lists at most this many unsafe values, `total` has the full count. */
export const EXPORT_ISSUES_MAX = 50

const commaSeparated = (value: unknown) => (typeof value === 'string' ? value.split(',').filter((id) => id !== '') : value)

/** Query of `GET /api/projects/:projectId/export`. `languageIds` is comma-separated and decides the column order only through the project order. */
export const exportQuerySchema = z.object({
	format: exportFormatSchema.default('CSV'),
	languageIds: z.preprocess(
		commaSeparated,
		z
			.array(z.uuid())
			.min(1)
			.max(SUPPORTED_LANGUAGES.length)
			.refine((ids) => new Set(ids).size === ids.length),
	),
	status: exportStatusSchema.default('ALL'),
})

export type ExportQuery = z.infer<typeof exportQuerySchema>

export type ExportQueryInput = z.input<typeof exportQuerySchema>

/**
 * What would break the CSV for `convert-csv-to-json` of GoodRequest/i18nextJsonToCsv: it splits rows on `;`,
 * lines on a line break, and takes any line with `--name--` in it for a new namespace section.
 */
export const EXPORT_ISSUE_CODES = ['SEMICOLON', 'LINE_BREAK', 'SECTION_MARKER'] as const

export const exportIssueCodeSchema = z.enum(EXPORT_ISSUE_CODES)

export type ExportIssueCode = z.infer<typeof exportIssueCodeSchema>

/** `languageTag` is the language of the value, `null` for the key itself or the whole row (`SECTION_MARKER`). */
export const exportIssueSchema = z.object({
	code: exportIssueCodeSchema,
	keyId: z.uuid(),
	namespace: z.string(),
	key: z.string(),
	languageTag: z.string().nullable(),
})

export type ExportIssue = z.infer<typeof exportIssueSchema>

/** `error.details` of 422 `EXPORT_VALUE_UNSAFE`: the first `EXPORT_ISSUES_MAX` issues in file order and their total count. */
export const exportValueUnsafeDetailsSchema = z.object({
	issues: z.array(exportIssueSchema),
	total: z.number().int().nonnegative(),
})

export type ExportValueUnsafeDetails = z.infer<typeof exportValueUnsafeDetailsSchema>
