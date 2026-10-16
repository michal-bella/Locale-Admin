import { randomBytes } from 'node:crypto'

import { type APIRequest, expect } from '@playwright/test'

import { type AdminUser, MUTATION_HEADERS } from './api'
import { type Credentials, STORAGE_STATE } from './auth'

/** Every user the suite creates uses this prefix, so the teardown can delete them. */
export const TEST_EDITOR_EMAIL_PREFIX = 'e2e-editor-'

export const newTestEditorCredentials = (): Credentials => ({
	email: `${TEST_EDITOR_EMAIL_PREFIX}${Date.now()}-${randomBytes(3).toString('hex')}@example.com`,
	password: randomBytes(18).toString('base64url'),
})

export type TestUser = Credentials & Pick<AdminUser, 'id' | 'createdAt'>

/** Creates an EDITOR through `POST /api/admin/users` as the ADMIN (needs the ADMIN storage state from the setup project). */
export const createEditor = async (request: APIRequest, baseURL: string | undefined): Promise<TestUser> => {
	const api = await request.newContext({ baseURL, storageState: STORAGE_STATE.ADMIN })
	try {
		const credentials = newTestEditorCredentials()
		const response = await api.post('/api/admin/users', { data: credentials, headers: MUTATION_HEADERS })
		expect(response.status(), 'POST /api/admin/users').toBe(201)
		const { id, createdAt } = (await response.json()) as AdminUser
		return { ...credentials, id, createdAt }
	} finally {
		await api.dispose()
	}
}
