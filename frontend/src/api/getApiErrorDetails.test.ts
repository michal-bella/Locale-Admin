import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vite-plus/test'

import { ERROR_CODE, VALIDATION_CODE } from '@locale/shared'

import getApiErrorDetails from '@/api/getApiErrorDetails'

const axiosErrorWith = (data: unknown) =>
	new AxiosError('Request failed', 'ERR_BAD_RESPONSE', undefined, undefined, {
		data,
		status: 400,
		statusText: 'Bad Request',
		headers: {},
		config: { headers: new AxiosHeaders() },
	})

describe('getApiErrorDetails', () => {
	it('returns the field issues of a validation error', () => {
		const details = [{ path: 'email', code: VALIDATION_CODE.INVALID_EMAIL }]
		const error = axiosErrorWith({ error: { code: ERROR_CODE.VALIDATION_ERROR, message: 'Invalid', details } })
		expect(getApiErrorDetails(error)).toEqual(details)
	})

	it('returns no field issues for import file issues', () => {
		const details = { issues: [{ code: 'FILE_EMPTY' }], total: 1 }
		const error = axiosErrorWith({ error: { code: ERROR_CODE.IMPORT_FILE_INVALID, message: 'Invalid file', details } })
		expect(getApiErrorDetails(error)).toEqual([])
	})

	it('returns no field issues without details, for a non-contract body and a non-axios error', () => {
		expect(getApiErrorDetails(axiosErrorWith({ error: { code: ERROR_CODE.EMAIL_TAKEN, message: 'Email taken' } }))).toEqual([])
		expect(getApiErrorDetails(axiosErrorWith('<html>Bad Gateway</html>'))).toEqual([])
		expect(getApiErrorDetails(new Error('boom'))).toEqual([])
	})
})
