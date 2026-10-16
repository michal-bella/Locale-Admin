import { expect, test } from '@playwright/test'

import { readApiError } from '../support/api'
import { ANONYMOUS } from '../support/auth'

test.use({ storageState: ANONYMOUS })

const CREDENTIALS = { email: 'csrf-check@example.com', password: 'irrelevant' }

test('GET /api/health returns 200', async ({ request }) => {
	const response = await request.get('/api/health')
	expect(response.status()).toBe(200)
	expect(await response.json()).toMatchObject({ status: 'ok', db: { status: 'ok' } })
})

test('POST without X-Requested-With is rejected with CSRF_REJECTED', async ({ request }) => {
	const response = await request.post('/api/auth/login', { data: CREDENTIALS })
	expect(response.status()).toBe(403)
	expect((await readApiError(response)).code).toBe('CSRF_REJECTED')
})

test('POST with application/x-www-form-urlencoded is rejected with CSRF_REJECTED', async ({ request }) => {
	const response = await request.post('/api/auth/login', { form: CREDENTIALS, headers: { 'X-Requested-With': 'XMLHttpRequest' } })
	expect(response.status()).toBe(403)
	expect((await readApiError(response)).code).toBe('CSRF_REJECTED')
})
