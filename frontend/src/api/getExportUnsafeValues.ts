import { isAxiosError } from 'axios'

import { errorResponseSchema, exportValueUnsafeDetailsSchema, type ExportValueUnsafeDetails } from '@locale/shared'

/** `{ issues, total }` of a 422 `EXPORT_VALUE_UNSAFE` response, `null` for anything else. */
const getExportUnsafeValues = (error: unknown): ExportValueUnsafeDetails | null => {
	if (!isAxiosError(error)) {
		return null
	}
	const details = errorResponseSchema.safeParse(error.response?.data).data?.error.details
	return exportValueUnsafeDetailsSchema.safeParse(details).data ?? null
}

export default getExportUnsafeValues
