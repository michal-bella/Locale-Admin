import { isAxiosError } from 'axios'

import { type ERROR_CODE, errorResponseSchema } from '@locale/shared'

import { UNKNOWN_ERROR_CODE } from '@/lib/constants'

/** Returns the shared error code of a failed API request, or `UNKNOWN` when the response does not follow the error contract. */
const getApiErrorCode = (error: unknown): ERROR_CODE | typeof UNKNOWN_ERROR_CODE => {
	if (!isAxiosError(error)) {
		return UNKNOWN_ERROR_CODE
	}
	const parsed = errorResponseSchema.safeParse(error.response?.data)
	return parsed.success ? parsed.data.error.code : UNKNOWN_ERROR_CODE
}

export default getApiErrorCode
