import { z } from 'zod'

import { passwordSchema } from '@locale/shared'

const databaseUrlSchema = z.url({ protocol: /^postgres(ql)?$/ })

// z.coerce.boolean() would turn the string "false" into true.
const booleanStringSchema = z.enum(['true', 'false']).transform((value) => value === 'true')

const positiveIntSchema = z.coerce.number().int().positive()

export const envSchema = z.object({
	NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
	PORT: z.coerce.number().int().positive().default(3000),
	LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
	DATABASE_URL: databaseUrlSchema,
	SEED_ADMIN_PASSWORD: passwordSchema,
	APP_VERSION: z.string().min(1).default('0.0.0'),
	COOKIE_SECURE: booleanStringSchema.default(true),
	SESSION_TTL_DAYS: positiveIntSchema.default(7),
	SESSION_MAX_AGE_DAYS: positiveIntSchema.default(30),
	LOGIN_RATE_LIMIT_MAX: positiveIntSchema.default(10),
	LOGIN_RATE_LIMIT_WINDOW_MS: positiveIntSchema.default(900000),
})

export const seedEnvSchema = envSchema.pick({ DATABASE_URL: true, SEED_ADMIN_PASSWORD: true })

export type Env = z.infer<typeof envSchema>

export type Config = {
	nodeEnv: Env['NODE_ENV']
	port: number
	logLevel: Env['LOG_LEVEL']
	databaseUrl: string
	appVersion: string
	cookieSecure: boolean
	sessionTtlDays: number
	sessionMaxAgeDays: number
	loginRateLimitMax: number
	loginRateLimitWindowMs: number
}

/** Formats zod issues as `NAME: message` lines without echoing the values (they may be secrets). */
export const formatEnvError = (error: z.ZodError): string =>
	`Invalid environment variables:\n${error.issues.map((issue) => `  ${issue.path.join('.')}: ${issue.message}`).join('\n')}`

export const parseEnv = (env: NodeJS.ProcessEnv): Config => {
	const result = envSchema.safeParse(env)
	if (!result.success) {
		throw new Error(formatEnvError(result.error))
	}
	const data = result.data
	return {
		nodeEnv: data.NODE_ENV,
		port: data.PORT,
		logLevel: data.LOG_LEVEL,
		databaseUrl: data.DATABASE_URL,
		appVersion: data.APP_VERSION,
		cookieSecure: data.COOKIE_SECURE,
		sessionTtlDays: data.SESSION_TTL_DAYS,
		sessionMaxAgeDays: data.SESSION_MAX_AGE_DAYS,
		loginRateLimitMax: data.LOGIN_RATE_LIMIT_MAX,
		loginRateLimitWindowMs: data.LOGIN_RATE_LIMIT_WINDOW_MS,
	}
}
