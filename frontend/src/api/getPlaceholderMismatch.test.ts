import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vite-plus/test'

import { ERROR_CODE } from '@locale/shared'

import getPlaceholderMismatch from '@/api/getPlaceholderMismatch'

const axiosErrorWith = (data: unknown) =>
	new AxiosError('Request failed', 'ERR_BAD_RESPONSE', undefined, undefined, {
		data,
		status: 400,
		statusText: 'Bad Request',
		headers: {},
		config: { headers: new AxiosHeaders() },
	})

describe('getPlaceholderMismatch', () => {
	it('returns the missing and extra placeholders of a PLACEHOLDER_MISMATCH error', () => {
		const details = { missing: ['{{name}}'], extra: ['{{user}}'] }
		const error = axiosErrorWith({ error: { code: ERROR_CODE.PLACEHOLDER_MISMATCH, message: 'Mismatch', details } })
		expect(getPlaceholderMismatch(error)).toEqual(details)
	})

	it('returns null for another code, missing details, a non-contract body and a non-axios error', () => {
		expect(getPlaceholderMismatch(axiosErrorWith({ error: { code: ERROR_CODE.VALIDATION_ERROR, message: 'Invalid', details: [] } }))).toBeNull()
		expect(getPlaceholderMismatch(axiosErrorWith({ error: { code: ERROR_CODE.PLACEHOLDER_MISMATCH, message: 'Mismatch' } }))).toBeNull()
		expect(getPlaceholderMismatch(axiosErrorWith('<html>Bad Gateway</html>'))).toBeNull()
		expect(getPlaceholderMismatch(new Error('boom'))).toBeNull()
	})
})
