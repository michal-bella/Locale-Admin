import { createHash } from 'node:crypto'

import pg from 'pg'

import { getDatabaseUrl } from './env'
import { TEST_PROJECT_SLUG_PREFIX } from './projects'
import { TEST_USER_EMAIL_PREFIX } from './users'

export const withDb = async <T>(fn: (client: pg.Client) => Promise<T>): Promise<T> => {
	const client = new pg.Client({ connectionString: getDatabaseUrl() })
	await client.connect()
	try {
		return await fn(client)
	} finally {
		await client.end()
	}
}

/** SQL `LIKE` pattern matching every user created by the suite. */
export const TEST_USER_EMAIL_PATTERN = `${TEST_USER_EMAIL_PREFIX}%@example.com`

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

/** Deletes every user (members and admins) created by the suite; their sessions and memberships cascade. There is no DELETE endpoint yet. */
export const deleteTestUsers = () =>
	withDb(async (client) => {
		const result = await client.query(`DELETE FROM "User" WHERE email LIKE $1`, [TEST_USER_EMAIL_PATTERN])
		return result.rowCount ?? 0
	})

/** Deletes every project created by the suite; memberships cascade. There is no DELETE endpoint yet. */
export const deleteTestProjects = () =>
	withDb(async (client) => {
		const result = await client.query(`DELETE FROM "Project" WHERE slug LIKE $1`, [`${TEST_PROJECT_SLUG_PREFIX}%`])
		return result.rowCount ?? 0
	})
