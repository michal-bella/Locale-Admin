import { readFileSync } from 'node:fs'
import path from 'node:path'

import { type APIRequestContext, expect } from '@playwright/test'

import { MUTATION_HEADERS } from './api'

export const FIXTURES_DIR = path.resolve(import.meta.dirname, '../fixtures')

/** Invented GoodRequest `i18nextJsonToCsv` file: 10 keys in `loc` and `paths`, columns sk, en, cs, `null` and `""` values, placeholders. */
export const SAMPLE_CSV = path.join(FIXTURES_DIR, 'import-sample.csv')

/** Row 3 has one field too many, row 4 an empty key. */
export const BROKEN_CSV = path.join(FIXTURES_DIR, 'import-broken.csv')

export const readFixture = (file: string) => readFileSync(file, 'utf8')

export const importPreviewApi = (projectId: string) => `/api/projects/${projectId}/imports/preview`

export const importApi = (projectId: string) => `/api/projects/${projectId}/imports`

export type ImportColumn = { columnIndex: number; languageId: string | null }

export type ImportResult = { keysCreated: number; translationsCreated: number; translationsUpdated: number; skippedColumns: number }

/** Imports a fixture through the API as the user of `api`. `columns` follows the contract: every language column of the file once. */
export const importFile = async (api: APIRequestContext, projectId: string, file: string, columns: ImportColumn[]) => {
	const response = await api.post(importApi(projectId), {
		data: { fileName: path.basename(file), content: readFixture(file), columns },
		headers: MUTATION_HEADERS,
	})
	expect(response.status(), `POST ${importApi(projectId)}`).toBe(200)
	return (await response.json()) as ImportResult
}
