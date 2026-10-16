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
		})
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
