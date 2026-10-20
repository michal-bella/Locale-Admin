import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, statSync } from 'node:fs'
import { basename } from 'node:path'
import { fileURLToPath } from 'node:url'

import pg from 'pg'
import { type TestProject } from 'vitest/node'

const BACKEND_DIR = fileURLToPath(new URL('..', import.meta.url))
const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url))
const ROOT_ENV_FILE = fileURLToPath(new URL('../../.env', import.meta.url))

/**
 * Every checkout shares one Postgres, and `setup.ts` truncates all tables before each test, so two checkouts running
 * at once would wipe each other's data. A git worktree (`.git` is a file) gets its own `<name>_<worktree>_<hash>_test`.
 */
const checkoutDatabaseName = (databaseName: string): string => {
	if (!statSync(`${REPO_ROOT}.git`, { throwIfNoEntry: false })?.isFile()) {
		return databaseName
	}
	const slug = basename(REPO_ROOT)
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, '_')
		.slice(0, 30)
	const hash = createHash('sha256').update(REPO_ROOT).digest('hex').slice(0, 8)
	return `${databaseName.slice(0, -'_test'.length)}_${slug}_${hash}_test`
}

const ensureDatabaseExists = async (databaseUrl: URL, databaseName: string) => {
	const adminUrl = new URL(databaseUrl)
	adminUrl.pathname = '/postgres'
	const client = new pg.Client({ connectionString: adminUrl.toString() })
	await client.connect()
	try {
		const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName])
		if (!rowCount) {
			await client.query(`CREATE DATABASE "${databaseName}"`)
		}
	} finally {
		await client.end()
	}
}

export default async function setup(project: TestProject) {
	if (existsSync(ROOT_ENV_FILE)) {
		process.loadEnvFile(ROOT_ENV_FILE)
	}
	const testDatabaseUrl = process.env.TEST_DATABASE_URL
	if (!testDatabaseUrl) {
		throw new Error('TEST_DATABASE_URL is not set. Integration tests need a dedicated *_test database.')
	}
	const url = new URL(testDatabaseUrl)
	const configuredName = decodeURIComponent(url.pathname.slice(1))
	// Guard: TRUNCATE runs before every test, so anything but a *_test database would lose its data.
	if (!configuredName.endsWith('_test')) {
		throw new Error(`Refusing to run integration tests: database "${configuredName}" does not end with _test.`)
	}
	const databaseName = checkoutDatabaseName(configuredName)
	url.pathname = `/${encodeURIComponent(databaseName)}`
	const databaseUrl = url.toString()

	// Workers inherit process.env, so nothing in a test can fall back to the dev database.
	process.env.DATABASE_URL = databaseUrl

	await ensureDatabaseExists(url, databaseName)
	execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
		cwd: BACKEND_DIR,
		env: { ...process.env, DATABASE_URL: databaseUrl },
		stdio: 'pipe',
	})

	project.provide('databaseUrl', databaseUrl)
}

declare module 'vitest' {
	// Module augmentation only works with an interface.
	// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
	export interface ProvidedContext {
		databaseUrl: string
	}
}
