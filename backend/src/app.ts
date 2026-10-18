import cookieParser from 'cookie-parser'
import express, { type Express } from 'express'
import helmet from 'helmet'
import { type Logger } from 'pino'
import { pinoHttp } from 'pino-http'

import { type Config } from './config/env'
import { type PrismaClient } from './lib/prisma'
import { csrfMiddleware } from './middleware/csrf.middleware'
import { errorMiddleware } from './middleware/error.middleware'
import { notFoundMiddleware } from './middleware/notFound.middleware'
import { createAdminRouter } from './routes/admin.routes'
import { createAuthRouter } from './routes/auth.routes'
import { createHealthRouter } from './routes/health.routes'
import { createProfileRouter } from './routes/profile.routes'
import { createProjectsRouter } from './routes/projects.routes'

export type AppDeps = {
	prisma: PrismaClient
	logger: Logger
}

export const createApp = (config: Config, deps: AppDeps): Express => {
	const app = express()

	// One proxy hop (nginx in Docker, Vite in dev) so req.ip and req.protocol come from X-Forwarded-*.
	app.set('trust proxy', 1)
	app.use(helmet())
	app.use(
		pinoHttp({
			logger: deps.logger,
			redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
			// The Docker healthcheck polls every 5 s.
			autoLogging: { ignore: (req) => req.url === '/api/health' },
		}),
	)
	app.use(cookieParser())
	// Before express.json() so a rejected request is never parsed.
	app.use(csrfMiddleware)
	app.use(express.json())

	app.use('/api/health', createHealthRouter(deps.prisma, config.appVersion))
	app.use('/api/auth', createAuthRouter(deps.prisma, config))
	app.use('/api/admin', createAdminRouter(deps.prisma, config))
	app.use('/api/profile', createProfileRouter(deps.prisma, config))
	app.use('/api/projects', createProjectsRouter(deps.prisma, config))
	app.use('/api', notFoundMiddleware)

	app.use(errorMiddleware)

	return app
}
