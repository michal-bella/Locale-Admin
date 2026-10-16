import { type ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'

import { ERROR_CODE, toValidationIssues, type ErrorResponse } from '@locale/shared'

import { AppError } from '../lib/errors'

const isJsonParseError = (err: unknown): boolean => err instanceof SyntaxError && 'type' in err && err.type === 'entity.parse.failed'

export const errorMiddleware: ErrorRequestHandler = (err: unknown, req, res, _next) => {
	let status: number
	let body: ErrorResponse

	if (err instanceof AppError) {
		status = err.status
		body = { error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) } }
	} else if (err instanceof ZodError) {
		status = 400
		body = { error: { code: ERROR_CODE.VALIDATION_ERROR, message: 'Request validation failed', details: toValidationIssues(err) } }
	} else if (isJsonParseError(err)) {
		status = 400
		body = { error: { code: ERROR_CODE.VALIDATION_ERROR, message: 'Malformed JSON body' } }
	} else {
		req.log.error({ err }, 'Unhandled error')
		status = 500
		body = { error: { code: ERROR_CODE.INTERNAL_ERROR, message: 'Internal server error' } }
	}

	res.status(status).json(body)
}
