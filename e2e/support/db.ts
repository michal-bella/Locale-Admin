import { createHash, randomBytes } from 'node:crypto'

import argon2 from 'argon2'
import pg from 'pg'

import { type Credentials } from './auth'
import { getDatabaseUrl } from './env'

export const withDb = async <T>(fn: (client: pg.Client) => Promise<T>): Promise<T> => {
	const client = new pg.Client({ connectionString: getDatabaseUrl() })
	await client.connect()
	try {
		return await fn(client)
	} finally {
		await client.end()
	}
}

export type TestUser = Credentials & { id: string }

/** Creates an EDITOR directly in the local DB. TODO(milestone C): switch to POST /api/admin/users. */
export const TEST_EDITOR_EMAIL_PATTERN = 'e2e-editor-%@example.com'

export const createEditor = async (): Promise<TestUser> => {
	const email = `e2e-editor-${Date.now()}-${randomBytes(3).toString('hex')}@example.com`
	const password = randomBytes(18).toString('base64url')
	const passwordHash = await argon2.hash(password, { type: argon2.argon2id })
	const id = await withDb(async (client) => {
		const result = await client.query<{ id: string }>(
			`INSERT INTO "User" (id, email, "passwordHash", role, "updatedAt") VALUES (gen_random_uuid(), $1, $2, 'EDITOR', now()) RETURNING id`,
			[email, passwordHash],
		)
		return result.rows[0]!.id
	})
	return { id, email, password }
}

export const hashSessionToken = (token: string) => createHash('sha256').update(token).digest('hex')

export const countSessionsByToken = (token: string) =>
	withDb(async (client) => {
		const result = await client.query<{ count: string }>(`SELECT count(*) FROM "Session" WHERE "tokenHash" = $1`, [hashSessionToken(token)])
		return Number(result.rows[0]!.count)
	})

export const getLastLoginAt = (email: string) =>
	withDb(async (client) => {
		const result = await client.query<{ lastLoginAt: Date | null }>(`SELECT "lastLoginAt" FROM "User" WHERE email = $1`, [email])
		return result.rows[0]?.lastLoginAt ?? null
	})

/** Deletes every EDITOR created by the suite; their sessions cascade. */
export const deleteTestEditors = () =>
	withDb(async (client) => {
		const result = await client.query(`DELETE FROM "User" WHERE role = 'EDITOR' AND email LIKE $1`, [TEST_EDITOR_EMAIL_PATTERN])
		return result.rowCount ?? 0
	})
