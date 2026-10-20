export type ConcurrencyLimiterOptions = { maxActive: number; queueMax: number; queueTimeoutMs: number }

/** Frees the slot; calling it again does nothing. */
export type Release = () => void

export type ConcurrencyLimiter = {
	/** A slot right away or after waiting in the queue; `null` when the queue is full, the wait times out or `signal` aborts. */
	acquire: (signal: AbortSignal) => Promise<Release | null>
	stats: () => { active: number; waiting: number }
}

type Waiter = { grant: () => void }

/** In-memory, so the limits apply per process (per pod). */
export const createConcurrencyLimiter = ({ maxActive, queueMax, queueTimeoutMs }: ConcurrencyLimiterOptions): ConcurrencyLimiter => {
	let active = 0
	const queue: Waiter[] = []

	const createRelease = (): Release => {
		let released = false
		return () => {
			if (released) {
				return
			}
			released = true
			const next = queue.shift()
			if (next) {
				next.grant()
			} else {
				active -= 1
			}
		}
	}

	const acquire = (signal: AbortSignal): Promise<Release | null> => {
		if (signal.aborted) {
			return Promise.resolve(null)
		}
		if (active < maxActive) {
			active += 1
			return Promise.resolve(createRelease())
		}
		if (queue.length >= queueMax) {
			return Promise.resolve(null)
		}
		return new Promise((resolve) => {
			const leave = () => {
				clearTimeout(timer)
				signal.removeEventListener('abort', leave)
				queue.splice(queue.indexOf(waiter), 1)
				resolve(null)
			}
			// The slot passes from the releasing holder straight to the waiter, so `active` stays the same.
			const waiter: Waiter = {
				grant: () => {
					clearTimeout(timer)
					signal.removeEventListener('abort', leave)
					resolve(createRelease())
				},
			}
			const timer = setTimeout(leave, queueTimeoutMs)
			signal.addEventListener('abort', leave)
			queue.push(waiter)
		})
	}

	return { acquire, stats: () => ({ active, waiting: queue.length }) }
}
