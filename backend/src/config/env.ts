import { z } from 'zod'

import { passwordSchema } from '@locale/shared'

const databaseUrlSchema = z.url({ protocol: /^postgres(ql)?$/ })

// z.coerce.boolean() would turn the string "false" into true.
const booleanStringSchema = z.enum(['true', 'false']).transform((value) => value === 'true')

const positiveIntSchema = z.coerce.number().int().positive()

const nonNegativeIntSchema = z.coerce.number().int().nonnegative()

// An empty value (`GOOGLE_CLIENT_ID=` in .env.example) means not set.
const optionalStringSchema = z
	.string()
	.trim()
	.optional()
	.transform((value) => value || undefined)

const GOOGLE_ENV_KEYS = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'] as const

const baseEnvSchema = z.object({
	NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
	PORT: z.coerce.number().int().positive().default(4000),
	LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
	DATABASE_URL: databaseUrlSchema,
	SEED_ADMIN_PASSWORD: passwordSchema,
	APP_VERSION: z.string().min(1).default('0.0.0'),
	COOKIE_SECURE: booleanStringSchema.default(true),
	SESSION_TTL_DAYS: positiveIntSchema.default(7),
	SESSION_MAX_AGE_DAYS: positiveIntSchema.default(30),
	LOGIN_RATE_LIMIT_MAX: positiveIntSchema.default(10),
	LOGIN_RATE_LIMIT_WINDOW_MS: positiveIntSchema.default(900000),
	EXPORT_MAX_CONCURRENT: positiveIntSchema.default(2),
	EXPORT_QUEUE_MAX: nonNegativeIntSchema.default(20),
	EXPORT_QUEUE_TIMEOUT_MS: positiveIntSchema.default(10000),
	EXPORT_TIMEOUT_MS: positiveIntSchema.default(60000),
	GOOGLE_CLIENT_ID: optionalStringSchema,
	GOOGLE_CLIENT_SECRET: optionalStringSchema,
	GOOGLE_REDIRECT_URI: optionalStringSchema.pipe(z.url({ protocol: /^https?$/ }).optional()),
})

export const envSchema = baseEnvSchema.superRefine((env, ctx) => {
	const missing = GOOGLE_ENV_KEYS.filter((key) => env[key] === undefined)
	if (missing.length > 0 && missing.length < GOOGLE_ENV_KEYS.length) {
		for (const key of missing) {
			ctx.addIssue({ code: 'custom', path: [key], message: `Set all of ${GOOGLE_ENV_KEYS.join(', ')} or none` })
		}
	}
})

export const seedEnvSchema = baseEnvSchema.pick({ DATABASE_URL: true, SEED_ADMIN_PASSWORD: true })

export type Env = z.infer<typeof envSchema>

/** Google sign-in (OpenID Connect); `redirectUri` is the callback registered in the Google client. */
export type GoogleConfig = {
	clientId: string
	clientSecret: string
	redirectUri: string
}

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
	/** Exports running at once per process; more wait in a queue of `exportQueueMax` for at most `exportQueueTimeoutMs`, then 429. */
	exportMaxConcurrent: number
	exportQueueMax: number
	exportQueueTimeoutMs: number
	/** Whole export including the client download; after it the connection is closed and the export stops at its next database call. */
	exportTimeoutMs: number
	/** `null` turns Google sign-in off: the endpoints return 404 and `GET /api/auth/providers` reports `google: false`. */
	google: GoogleConfig | null
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
		exportMaxConcurrent: data.EXPORT_MAX_CONCURRENT,
		exportQueueMax: data.EXPORT_QUEUE_MAX,
		exportQueueTimeoutMs: data.EXPORT_QUEUE_TIMEOUT_MS,
		exportTimeoutMs: data.EXPORT_TIMEOUT_MS,
		google:
			data.GOOGLE_CLIENT_ID && data.GOOGLE_CLIENT_SECRET && data.GOOGLE_REDIRECT_URI
				? { clientId: data.GOOGLE_CLIENT_ID, clientSecret: data.GOOGLE_CLIENT_SECRET, redirectUri: data.GOOGLE_REDIRECT_URI }
				: null,
	}
}
