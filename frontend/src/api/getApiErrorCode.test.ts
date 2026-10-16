import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vite-plus/test'

import { ERROR_CODE } from '@locale/shared'

import getApiErrorCode from '@/api/getApiErrorCode'
import { UNKNOWN_ERROR_CODE } from '@/lib/constants'

const axiosErrorWith = (data: unknown) =>
	new AxiosError('Request failed', 'ERR_BAD_RESPONSE', undefined, undefined, {
		data,
		status: 400,
		statusText: 'Bad Request',
		headers: {},
		config: { headers: new AxiosHeaders() },
	})

describe('getApiErrorCode', () => {
	it('returns the code of a contract error response', () => {
		const error = axiosErrorWith({ error: { code: ERROR_CODE.EMAIL_TAKEN, message: 'Email taken' } })
		expect(getApiErrorCode(error)).toBe(ERROR_CODE.EMAIL_TAKEN)
	})

	it('returns UNKNOWN for an unknown code', () => {
		expect(getApiErrorCode(axiosErrorWith({ error: { code: 'SOMETHING_NEW', message: 'x' } }))).toBe(UNKNOWN_ERROR_CODE)
	})

	it('returns UNKNOWN for a non-contract body, a network error and a non-axios error', () => {
		expect(getApiErrorCode(axiosErrorWith('<html>Bad Gateway</html>'))).toBe(UNKNOWN_ERROR_CODE)
		expect(getApiErrorCode(new AxiosError('Network Error', 'ERR_NETWORK'))).toBe(UNKNOWN_ERROR_CODE)
		expect(getApiErrorCode(new Error('boom'))).toBe(UNKNOWN_ERROR_CODE)
	})
})
