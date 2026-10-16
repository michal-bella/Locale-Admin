import express, { type Express } from 'express'
import helmet from 'helmet'
import { type Logger } from 'pino'
import { pinoHttp } from 'pino-http'

import { type Config } from './config/env'
import { type PrismaClient } from './lib/prisma'
import { errorMiddleware } from './middleware/error.middleware'
import { notFoundMiddleware } from './middleware/notFound.middleware'
import { createHealthRouter } from './routes/health.routes'

export type AppDeps = {
	prisma: PrismaClient
	logger: Logger
}

export const createApp = (config: Pick<Config, 'appVersion'>, deps: AppDeps): Express => {
	const app = express()

	// One proxy hop (nginx in Docker, Vite in dev) so req.ip and req.protocol come from X-Forwarded-*.
	app.set('trust proxy', 1)
	app.use(helmet())
	app.use(pinoHttp({ logger: deps.logger }))
	app.use(express.json())

	app.use('/api/health', createHealthRouter(deps.prisma, config.appVersion))
	app.use('/api', notFoundMiddleware)

	app.use(errorMiddleware)

	return app
}
