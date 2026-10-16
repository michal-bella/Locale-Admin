import { existsSync } from 'node:fs'
import path from 'node:path'

const ENV_FILE = path.resolve(import.meta.dirname, '../../.env')

// Variables already set in the shell win over .env (same as `node --env-file`).
if (existsSync(ENV_FILE)) {
	process.loadEnvFile(ENV_FILE)
}

const requireEnv = (name: string): string => {
	const value = process.env[name]
	if (!value) {
		throw new Error(`Missing ${name}: set it in .env or in the shell`)
	}
	return value
}

export const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:8080'

export const ADMIN_EMAIL = 'michal.bella@goodrequest.com'

export const getAdminPassword = () => requireEnv('SEED_ADMIN_PASSWORD')

export const getDatabaseUrl = () => requireEnv('DATABASE_URL')
