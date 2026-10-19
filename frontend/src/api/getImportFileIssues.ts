import { isAxiosError } from 'axios'

import { errorResponseSchema, type ImportFileInvalidDetails } from '@locale/shared'

/** `{ issues, total }` of a 422 `IMPORT_FILE_INVALID` response, `null` for anything else. */
const getImportFileIssues = (error: unknown): ImportFileInvalidDetails | null => {
	if (!isAxiosError(error)) {
		return null
	}
	const details = errorResponseSchema.safeParse(error.response?.data).data?.error.details
	return details && !Array.isArray(details) ? details : null
}

export default getImportFileIssues
