import { describe, expect, it } from 'vitest'

import { parseEnv } from './env'

const VALID_ENV = {
	DATABASE_URL: 'postgresql://locale:locale@localhost:5433/locale',
	SEED_ADMIN_PASSWORD: 'ValidPassword1',
}

describe('parseEnv', () => {
	it('applies defaults', () => {
		expect(parseEnv(VALID_ENV)).toEqual({
			nodeEnv: 'development',
			port: 3000,
			logLevel: 'info',
			databaseUrl: VALID_ENV.DATABASE_URL,
			appVersion: '0.0.0',
			cookieSecure: true,
			sessionTtlDays: 7,
			sessionMaxAgeDays: 30,
			loginRateLimitMax: 10,
			loginRateLimitWindowMs: 900000,
		})
	})

	it.each([
		['true', true],
		['false', false],
	])('parses COOKIE_SECURE=%s as %s', (value, expected) => {
		expect(parseEnv({ ...VALID_ENV, COOKIE_SECURE: value }).cookieSecure).toBe(expected)
	})

	it.each(['1', '0', 'yes', 'FALSE', ''])('rejects COOKIE_SECURE=%j', (value) => {
		expect(() => parseEnv({ ...VALID_ENV, COOKIE_SECURE: value })).toThrow(/COOKIE_SECURE/)
	})

	it('parses session and rate limit numbers from strings', () => {
		expect(
			parseEnv({
				...VALID_ENV,
				SESSION_TTL_DAYS: '1',
				SESSION_MAX_AGE_DAYS: '2',
				LOGIN_RATE_LIMIT_MAX: '1000',
				LOGIN_RATE_LIMIT_WINDOW_MS: '60000',
			}),
		).toMatchObject({ sessionTtlDays: 1, sessionMaxAgeDays: 2, loginRateLimitMax: 1000, loginRateLimitWindowMs: 60000 })
	})

	it.each(['SESSION_TTL_DAYS', 'SESSION_MAX_AGE_DAYS', 'LOGIN_RATE_LIMIT_MAX', 'LOGIN_RATE_LIMIT_WINDOW_MS'])('rejects a non-positive %s', (name) => {
		expect(() => parseEnv({ ...VALID_ENV, [name]: '0' })).toThrow(new RegExp(name))
	})

	it('rejects a missing SEED_ADMIN_PASSWORD', () => {
		expect(() => parseEnv({ DATABASE_URL: VALID_ENV.DATABASE_URL })).toThrow(/SEED_ADMIN_PASSWORD/)
	})

	it('rejects a SEED_ADMIN_PASSWORD that breaks the password rules', () => {
		expect(() => parseEnv({ ...VALID_ENV, SEED_ADMIN_PASSWORD: 'short' })).toThrow(/SEED_ADMIN_PASSWORD/)
	})

	it('rejects a non-Postgres DATABASE_URL', () => {
		expect(() => parseEnv({ ...VALID_ENV, DATABASE_URL: 'mysql://localhost/locale' })).toThrow(/DATABASE_URL/)
	})
})
