import { pino, type Logger } from 'pino'

import { type Config } from '../config/env'

export const createLogger = (config: Pick<Config, 'nodeEnv' | 'logLevel'>): Logger =>
	pino({
		level: config.logLevel,
		// pino-pretty is a dev dependency, so it must not be referenced in the production image.
		...(config.nodeEnv === 'development' ? { transport: { target: 'pino-pretty' } } : {}),
	})
