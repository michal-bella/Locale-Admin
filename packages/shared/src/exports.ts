import { z } from 'zod'

import { SUPPORTED_LANGUAGES } from './languages'

/** CSV (GoodRequest i18nextJsonToCsv) and XLSX (one sheet: Namespace, Key and a column per language); JSON and ARB come later. */
export const exportFormatSchema = z.enum(['CSV', 'XLSX'])

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

const emptyToUndefined = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? undefined : value)

/**
 * Query of `GET /api/projects/:projectId/export`. `languageIds` is comma-separated and decides the column order only through the project order.
 * `versionId` is the version whose keys make the file; `diffOnly` keeps only the keys added or changed against the previous version.
 */
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
	versionId: z.preprocess(emptyToUndefined, z.uuid()),
	/** `true` (also `'true'` or `'1'`): only keys added or changed against the nearest older version (the diff of the version). */
	diffOnly: z.preprocess((value) => (value === true || value === 'true' || value === '1' ? true : undefined), z.literal(true).optional()),
})

export type ExportQuery = z.infer<typeof exportQuerySchema>

export type ExportQueryInput = z.input<typeof exportQuerySchema>

/** Query of `GET /api/projects/:projectId/export/check`: the languages and status of the planned export, no format. */
export const exportCheckQuerySchema = exportQuerySchema.omit({ format: true })

export type ExportCheckQuery = z.infer<typeof exportCheckQuerySchema>

export type ExportCheckQueryInput = z.input<typeof exportCheckQuerySchema>

/**
 * A value whose placeholders differ from the base language (the base value, or the key name when the base is empty and the name has
 * placeholders): `missing` are placeholders of the base the value lacks, `extra` the ones the base does not have (typos).
 */
export const exportWarningSchema = z.object({
	keyId: z.uuid(),
	namespace: z.string(),
	key: z.string(),
	languageTag: z.string(),
	missing: z.array(z.string()),
	extra: z.array(z.string()),
})

export type ExportWarning = z.infer<typeof exportWarningSchema>

/** Body of `200 GET …/export/check`: the first `EXPORT_ISSUES_MAX` warnings in file order and their total count. The export runs anyway. */
export const exportCheckResponseSchema = z.object({
	warnings: z.array(exportWarningSchema),
	total: z.number().int().nonnegative(),
})

export type ExportCheckResponse = z.infer<typeof exportCheckResponseSchema>

/**
 * What would break the CSV for `convert-csv-to-json` of GoodRequest/i18nextJsonToCsv: it splits rows on `;`,
 * lines on a line break, takes any line with `--name--` in it for a new namespace section, and reads a namespace
 * with `--` or a trailing `-` back differently (`NAMESPACE`).
 */
export const EXPORT_ISSUE_CODES = ['SEMICOLON', 'LINE_BREAK', 'SECTION_MARKER', 'NAMESPACE'] as const

export const exportIssueCodeSchema = z.enum(EXPORT_ISSUE_CODES)

export type ExportIssueCode = z.infer<typeof exportIssueCodeSchema>

/** `languageTag` is the language of the value, `null` for the key itself, the whole row (`SECTION_MARKER`) or its namespace (`NAMESPACE`). */
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
