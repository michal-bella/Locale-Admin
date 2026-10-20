import { isAxiosError } from 'axios'

import { errorResponseSchema, importFileInvalidDetailsSchema, type ImportFileInvalidDetails } from '@locale/shared'

/** `{ issues, total }` of a 422 `IMPORT_FILE_INVALID` response, `null` for anything else. */
const getImportFileIssues = (error: unknown): ImportFileInvalidDetails | null => {
	if (!isAxiosError(error)) {
		return null
	}
	const details = errorResponseSchema.safeParse(error.response?.data).data?.error.details
	return importFileInvalidDetailsSchema.safeParse(details).data ?? null
}

export default getImportFileIssues
