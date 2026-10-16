import { createApp } from './app'
import { parseEnv } from './config/env'
import { createLogger } from './lib/logger'
import { createPrismaClient } from './lib/prisma'

const config = parseEnv(process.env)
const logger = createLogger(config)
const prisma = createPrismaClient(config.databaseUrl)
const app = createApp(config, { prisma, logger })

const server = app.listen(config.port, () => {
	logger.info({ port: config.port, version: config.appVersion }, 'Backend listening')
})

const shutdown = (signal: NodeJS.Signals) => {
	logger.info({ signal }, 'Shutting down')
	server.close(() => {
		void prisma.$disconnect().finally(() => process.exit(0))
	})
}

process.once('SIGTERM', shutdown)
process.once('SIGINT', shutdown)
