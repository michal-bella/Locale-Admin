import { type InternalAxiosRequestConfig } from 'axios'
import { describe, expect, it } from 'vite-plus/test'

import http from '@/api/http'

const captureRequest = async (request: (adapter: (config: InternalAxiosRequestConfig) => Promise<never>) => Promise<unknown>) => {
	let captured: InternalAxiosRequestConfig | undefined
	await request((config) => {
		captured = config
		return Promise.reject(new Error('stop'))
	}).catch(() => undefined)
	if (!captured) {
		throw new Error('request was not sent')
	}
	return captured
}

describe('http', () => {
	it('uses the same-origin /api base URL with credentials', () => {
		expect(http.defaults.baseURL).toBe('/api')
		expect(http.defaults.withCredentials).toBe(true)
	})

	it('sends X-Requested-With on every request', async () => {
		const config = await captureRequest((adapter) => http.get('/health', { adapter }))
		expect(config.headers.get('X-Requested-With')).toBe('XMLHttpRequest')
		expect(config.data).toBeUndefined()
	})

	it.each(['post', 'put', 'patch', 'delete'] as const)('sends an empty JSON body on %s without data', async (method) => {
		const config = await captureRequest((adapter) => http.request({ method, url: '/auth/logout', adapter }))
		expect(config.data).toBe('{}')
		expect(config.headers.get('Content-Type')).toBe('application/json')
		expect(config.headers.get('X-Requested-With')).toBe('XMLHttpRequest')
	})

	it('keeps an existing mutation body', async () => {
		const config = await captureRequest((adapter) => http.post('/auth/login', { email: 'a@b.sk' }, { adapter }))
		expect(config.data).toBe('{"email":"a@b.sk"}')
	})
})
