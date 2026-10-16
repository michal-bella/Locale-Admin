import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'prisma/config'

// Prisma 7 does not load .env. Variables already set (Docker, test globalSetup) win over the file.
const rootEnvFile = fileURLToPath(new URL('../.env', import.meta.url))
if (existsSync(rootEnvFile)) {
	process.loadEnvFile(rootEnvFile)
}

export default defineConfig({
	schema: 'prisma/schema.prisma',
	migrations: { path: 'prisma/migrations' },
	datasource: { url: process.env.DATABASE_URL },
})
