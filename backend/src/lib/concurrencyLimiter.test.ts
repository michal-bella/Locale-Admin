import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createConcurrencyLimiter } from './concurrencyLimiter'

const signal = () => new AbortController().signal

describe('createConcurrencyLimiter', () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it('gives slots up to the limit, then queues and hands a released slot to the first waiter', async () => {
		const limiter = createConcurrencyLimiter({ maxActive: 2, queueMax: 2, queueTimeoutMs: 1000 })
		const first = await limiter.acquire(signal())
		await limiter.acquire(signal())
		const third = limiter.acquire(signal())
		const fourth = limiter.acquire(signal())
		expect(limiter.stats()).toEqual({ active: 2, waiting: 2 })

		first?.()
		first?.()
		const thirdRelease = await third
		expect(thirdRelease).toBeTypeOf('function')
		expect(limiter.stats()).toEqual({ active: 2, waiting: 1 })

		thirdRelease?.()
		expect(await fourth).toBeTypeOf('function')
		expect(limiter.stats()).toEqual({ active: 2, waiting: 0 })
	})

	it('refuses right away when the queue is full', async () => {
		const limiter = createConcurrencyLimiter({ maxActive: 1, queueMax: 0, queueTimeoutMs: 1000 })
		await limiter.acquire(signal())

		expect(await limiter.acquire(signal())).toBeNull()
		expect(limiter.stats()).toEqual({ active: 1, waiting: 0 })
	})

	it('refuses a waiter after the queue timeout and frees its place', async () => {
		const limiter = createConcurrencyLimiter({ maxActive: 1, queueMax: 1, queueTimeoutMs: 1000 })
		const holder = await limiter.acquire(signal())
		const waiting = limiter.acquire(signal())

		await vi.advanceTimersByTimeAsync(1000)

		expect(await waiting).toBeNull()
		expect(limiter.stats()).toEqual({ active: 1, waiting: 0 })
		holder?.()
		expect(limiter.stats()).toEqual({ active: 0, waiting: 0 })
	})

	it('drops a waiter whose signal aborts and refuses an already aborted one', async () => {
		const limiter = createConcurrencyLimiter({ maxActive: 1, queueMax: 2, queueTimeoutMs: 1000 })
		const holder = await limiter.acquire(signal())
		const closed = new AbortController()
		const aborted = limiter.acquire(closed.signal)
		const next = limiter.acquire(signal())

		closed.abort()

		expect(await aborted).toBeNull()
		expect(await limiter.acquire(closed.signal)).toBeNull()
		holder?.()
		expect(await next).toBeTypeOf('function')
		expect(limiter.stats()).toEqual({ active: 1, waiting: 0 })
	})
})
