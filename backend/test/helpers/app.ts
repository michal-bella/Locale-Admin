import { pino } from 'pino'

import { createApp } from '../../src/app'
import { type Config } from '../../src/config/env'
import { type PrismaClient } from '../../src/lib/prisma'

import { getTestPrisma } from './db'

export const TEST_CONFIG: Config = {
	nodeEnv: 'test',
	port: 0,
	logLevel: 'silent',
	databaseUrl: '',
	appVersion: '0.0.0-test',
	cookieSecure: false,
	sessionTtlDays: 7,
	sessionMaxAgeDays: 30,
	loginRateLimitMax: 1000,
	loginRateLimitWindowMs: 900000,
}

export const createTestApp = ({ config, prisma }: { config?: Partial<Config>; prisma?: PrismaClient } = {}) =>
	createApp({ ...TEST_CONFIG, ...config }, { prisma: prisma ?? getTestPrisma(), logger: pino({ level: 'silent' }) })
