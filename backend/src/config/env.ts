import { z } from 'zod'

import { passwordSchema } from '@locale/shared'

const databaseUrlSchema = z.url({ protocol: /^postgres(ql)?$/ })

export const envSchema = z.object({
	NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
	PORT: z.coerce.number().int().positive().default(3000),
	LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
	DATABASE_URL: databaseUrlSchema,
	SEED_ADMIN_PASSWORD: passwordSchema,
	APP_VERSION: z.string().min(1).default('0.0.0'),
})

export const seedEnvSchema = envSchema.pick({ DATABASE_URL: true, SEED_ADMIN_PASSWORD: true })

export type Env = z.infer<typeof envSchema>

export type Config = {
	nodeEnv: Env['NODE_ENV']
	port: number
	logLevel: Env['LOG_LEVEL']
	databaseUrl: string
	appVersion: string
}

/** Formats zod issues as `NAME: message` lines without echoing the values (they may be secrets). */
export const formatEnvError = (error: z.ZodError): string =>
	`Invalid environment variables:\n${error.issues.map((issue) => `  ${issue.path.join('.')}: ${issue.message}`).join('\n')}`

export const parseEnv = (env: NodeJS.ProcessEnv): Config => {
	const result = envSchema.safeParse(env)
	if (!result.success) {
		throw new Error(formatEnvError(result.error))
	}
	const { NODE_ENV, PORT, LOG_LEVEL, DATABASE_URL, APP_VERSION } = result.data
	return { nodeEnv: NODE_ENV, port: PORT, logLevel: LOG_LEVEL, databaseUrl: DATABASE_URL, appVersion: APP_VERSION }
}
