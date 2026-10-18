import { isAxiosError } from 'axios'

import { errorResponseSchema, type ValidationIssue } from '@locale/shared'

/** Field issues of a `VALIDATION_ERROR` response, empty for anything else. */
const getApiErrorDetails = (error: unknown): ValidationIssue[] => {
	if (!isAxiosError(error)) {
		return []
	}
	const details = errorResponseSchema.safeParse(error.response?.data).data?.error.details
	return Array.isArray(details) ? details : []
}

export default getApiErrorDetails
