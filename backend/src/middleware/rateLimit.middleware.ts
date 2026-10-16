import { type RequestHandler } from 'express'
import { rateLimit } from 'express-rate-limit'

import { ERROR_CODE } from '@locale/shared'

import { type Config } from '../config/env'
import { AppError } from '../lib/errors'

/** In-memory store per instance; every attempt counts. express-rate-limit sets `Retry-After` before calling the handler. */
export const createLoginRateLimiter = (config: Pick<Config, 'loginRateLimitMax' | 'loginRateLimitWindowMs'>): RequestHandler =>
	rateLimit({
		limit: config.loginRateLimitMax,
		windowMs: config.loginRateLimitWindowMs,
		standardHeaders: 'draft-8',
		legacyHeaders: false,
		handler: (_req, _res, next) => {
			next(new AppError(429, ERROR_CODE.RATE_LIMITED, 'Too many login attempts'))
		},
	})
