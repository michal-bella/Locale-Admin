import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import pg from 'pg'
import { type TestProject } from 'vitest/node'

const BACKEND_DIR = fileURLToPath(new URL('..', import.meta.url))
const ROOT_ENV_FILE = fileURLToPath(new URL('../../.env', import.meta.url))

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
	const databaseName = decodeURIComponent(url.pathname.slice(1))
	// Guard: TRUNCATE runs before every test, so anything but a *_test database would lose its data.
	if (!databaseName.endsWith('_test')) {
		throw new Error(`Refusing to run integration tests: database "${databaseName}" does not end with _test.`)
	}

	// Workers inherit process.env, so nothing in a test can fall back to the dev database.
	process.env.DATABASE_URL = testDatabaseUrl

	await ensureDatabaseExists(url, databaseName)
	execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
		cwd: BACKEND_DIR,
		env: { ...process.env, DATABASE_URL: testDatabaseUrl },
		stdio: 'pipe',
	})

	project.provide('databaseUrl', testDatabaseUrl)
}

declare module 'vitest' {
	// Module augmentation only works with an interface.
	// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
	export interface ProvidedContext {
		databaseUrl: string
	}
}
