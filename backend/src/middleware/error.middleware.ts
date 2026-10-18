import { type ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'

import { ERROR_CODE, toValidationIssues, type ErrorResponse } from '@locale/shared'

import { AppError } from '../lib/errors'

import { isImportRequest } from './jsonBody.middleware'

type BodyParserError = Error & { type: string; status: number; expose: boolean }

const isJsonParseError = (err: unknown): boolean => err instanceof SyntaxError && 'type' in err && err.type === 'entity.parse.failed'

// body-parser marks client errors (413 entity.too.large, 415 charset/encoding.unsupported, ...) with a `type`, a 4xx `status` and `expose: true`.
const isBodyParserClientError = (err: unknown): err is BodyParserError =>
	err instanceof Error &&
	'type' in err &&
	typeof err.type === 'string' &&
	'status' in err &&
	typeof err.status === 'number' &&
	err.status >= 400 &&
	err.status < 500 &&
	'expose' in err &&
	err.expose === true

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
	} else if (isBodyParserClientError(err)) {
		req.log.warn({ err }, 'Rejected request body')
		status = err.status
		const code = err.type === 'entity.too.large' && isImportRequest(req) ? ERROR_CODE.IMPORT_FILE_TOO_LARGE : ERROR_CODE.VALIDATION_ERROR
		body = { error: { code, message: err.message } }
	} else {
		req.log.error({ err }, 'Unhandled error')
		status = 500
		body = { error: { code: ERROR_CODE.INTERNAL_ERROR, message: 'Internal server error' } }
	}

	res.status(status).json(body)
}
