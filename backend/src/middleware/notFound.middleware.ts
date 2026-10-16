import { type RequestHandler } from 'express'

import { ERROR_CODE } from '@locale/shared'

import { AppError } from '../lib/errors'

export const notFoundMiddleware: RequestHandler = (req, _res, next) => {
	next(new AppError(404, ERROR_CODE.NOT_FOUND, `Route ${req.method} ${req.originalUrl} not found`))
}
