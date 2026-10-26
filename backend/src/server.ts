import { createApp } from './app'
import { parseEnv } from './config/env'
import { createGoogleOidc } from './lib/googleOidc'
import { createLogger } from './lib/logger'
import { getDummyPasswordHash } from './lib/password'
import { createPrismaClient } from './lib/prisma'

const config = parseEnv(process.env)
const logger = createLogger(config)
const prisma = createPrismaClient(config.databaseUrl)
const app = createApp(config, { prisma, logger, googleOidc: config.google ? createGoogleOidc(config.google) : undefined })

// Warm-up so the first unknown-email login does not pay for creating the dummy hash (timing side channel).
void getDummyPasswordHash()

// With trust proxy 1 a LAN client could spoof X-Forwarded-For and bypass the login rate limit, so dev listens on
// loopback only (Vite proxies from the same machine). The Docker container must listen on all interfaces for nginx.
const host = config.nodeEnv === 'development' ? '127.0.0.1' : undefined

const server = app.listen({ port: config.port, host }, () => {
	logger.info({ host, port: config.port, version: config.appVersion }, 'Backend listening')
})

const shutdown = (signal: NodeJS.Signals) => {
	logger.info({ signal }, 'Shutting down')
	server.close(() => {
		void prisma.$disconnect().finally(() => process.exit(0))
	})
}

process.once('SIGTERM', shutdown)
process.once('SIGINT', shutdown)
