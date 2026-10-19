import { QueryClient } from '@tanstack/react-query'

import { ERROR_CODE } from '@locale/shared'

import getApiErrorCode from '@/api/getApiErrorCode'
import { isUnauthorizedError } from '@/api/isUnauthorizedError'

const MAX_RETRIES = 3

const retryQuery = (failureCount: number, error: unknown) => !isUnauthorizedError(error) && failureCount < MAX_RETRIES

/** The default retry, except for 404: for a query whose record can be deleted meanwhile (the edit modal on Projekty). */
export const retryUnlessNotFound = (failureCount: number, error: unknown) => getApiErrorCode(error) !== ERROR_CODE.NOT_FOUND && retryQuery(failureCount, error)

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			retry: retryQuery,
		},
	},
})

export default queryClient
