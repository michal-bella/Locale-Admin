import { Writable } from 'node:stream'

import express from 'express'
import { pino } from 'pino'
import { pinoHttp } from 'pino-http'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { ERROR_CODE, VALIDATION_CODE, emailSchema, errorResponseSchema } from '@locale/shared'

import { AppError } from '../lib/errors'

import { errorMiddleware } from './error.middleware'

const createLogCapture = () => {
	const lines: { level: string; msg: string }[] = []
	const stream = new Writable({
		write(chunk: Buffer, _encoding, callback) {
			lines.push(JSON.parse(chunk.toString()) as { level: string; msg: string })
			callback()
		},
	})
	return { logger: pino({ level: 'info', formatters: { level: (label) => ({ level: label }) } }, stream), lines }
}

const createAppThatThrows = (error: unknown, logger = pino({ level: 'silent' })) => {
	const app = express()
	app.use(pinoHttp({ logger }))
	app.use(express.json())
	app.post('/boom', () => {
		throw error
	})
	app.use(errorMiddleware)
	return app
}

describe('errorMiddleware', () => {
	it('formats an AppError with its status and code', async () => {
		const res = await request(createAppThatThrows(new AppError(403, ERROR_CODE.FORBIDDEN, 'Nope'))).post('/boom')

		expect(res.status).toBe(403)
		expect(res.body).toEqual({ error: { code: ERROR_CODE.FORBIDDEN, message: 'Nope' } })
	})

	it('maps a ZodError to 400 VALIDATION_ERROR with shared validation codes', async () => {
		const zodError = z.object({ email: emailSchema }).safeParse({ email: 'not-an-email' }).error

		const res = await request(createAppThatThrows(zodError)).post('/boom')

		expect(res.status).toBe(400)
		expect(res.body).toEqual({
			error: {
				code: ERROR_CODE.VALIDATION_ERROR,
				message: expect.any(String) as unknown,
				details: [{ path: 'email', code: VALIDATION_CODE.INVALID_EMAIL }],
			},
		})
	})

	it('maps malformed JSON to 400 VALIDATION_ERROR', async () => {
		const res = await request(createAppThatThrows(new Error('unreachable')))
			.post('/boom')
			.set('Content-Type', 'application/json')
			.send('{"a":')

		expect(res.status).toBe(400)
		expect(errorResponseSchema.parse(res.body).error.code).toBe(ERROR_CODE.VALIDATION_ERROR)
	})

	it('maps an oversized body to 413 VALIDATION_ERROR and logs it as a warning', async () => {
		const { logger, lines } = createLogCapture()

		const res = await request(createAppThatThrows(new Error('unreachable'), logger))
			.post('/boom')
			.set('Content-Type', 'application/json')
			.send(JSON.stringify({ text: 'x'.repeat(200 * 1024) }))

		expect(res.status).toBe(413)
		expect(errorResponseSchema.parse(res.body).error.code).toBe(ERROR_CODE.VALIDATION_ERROR)
		expect(lines.find((line) => line.msg === 'Rejected request body')?.level).toBe('warn')
		expect(lines.some((line) => line.level === 'error' || line.level === 'fatal')).toBe(false)
	})

	it('maps an unsupported charset to 415 VALIDATION_ERROR', async () => {
		const res = await request(createAppThatThrows(new Error('unreachable')))
			.post('/boom')
			.set('Content-Type', 'application/json; charset=latin1')
			.send('{"a":1}')

		expect(res.status).toBe(415)
		expect(errorResponseSchema.parse(res.body).error.code).toBe(ERROR_CODE.VALIDATION_ERROR)
	})

	it('hides unknown errors behind 500 INTERNAL_ERROR without a stack', async () => {
		const res = await request(createAppThatThrows(new Error('secret internals'))).post('/boom')

		expect(res.status).toBe(500)
		expect(res.body).toEqual({ error: { code: ERROR_CODE.INTERNAL_ERROR, message: 'Internal server error' } })
		expect(JSON.stringify(res.body)).not.toContain('secret internals')
	})
})
