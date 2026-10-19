import { isAxiosError } from 'axios'

import { ERROR_CODE, errorResponseSchema, type PlaceholderMismatchDetails } from '@locale/shared'

/** `{ missing, extra }` of a 400 `PLACEHOLDER_MISMATCH` response, `null` for anything else. */
const getPlaceholderMismatch = (error: unknown): PlaceholderMismatchDetails | null => {
	if (!isAxiosError(error)) {
		return null
	}
	const parsed = errorResponseSchema.safeParse(error.response?.data).data?.error
	if (parsed?.code !== ERROR_CODE.PLACEHOLDER_MISMATCH || !parsed.details || Array.isArray(parsed.details) || !('missing' in parsed.details)) {
		return null
	}
	return parsed.details
}

export default getPlaceholderMismatch
