import { type RequestHandler } from 'express'

import { ERROR_CODE } from '@locale/shared'

import { AppError } from '../lib/errors'

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** A cross-site form cannot send JSON with a custom header without a CORS preflight, and CORS is not enabled. */
export const csrfMiddleware: RequestHandler = (req, _res, next) => {
	if (!STATE_CHANGING_METHODS.has(req.method) || (req.is('application/json') && req.get('X-Requested-With') === 'XMLHttpRequest')) {
		next()
		return
	}
	next(new AppError(403, ERROR_CODE.CSRF_REJECTED, 'State-changing requests need Content-Type: application/json and X-Requested-With: XMLHttpRequest'))
}
