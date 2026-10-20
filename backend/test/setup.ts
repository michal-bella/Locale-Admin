import { createServer, type RequestListener } from 'node:http'
import { type AddressInfo } from 'node:net'

import { afterAll, beforeAll, beforeEach, vi } from 'vitest'

import { disconnectTestPrisma, truncateAllTables } from './helpers/db'

import type supertest from 'supertest'

// supertest(app) listens on `::` and then connects to 127.0.0.1. On macOS a process listening on 127.0.0.1 with the same
// ephemeral port (Postman, VS Code, …) takes that connection, so a random test got a foreign 404/400 with body {}.
// Every request goes through one server bound to 127.0.0.1 instead, which no other process can share.
const apps: RequestListener[] = []
const appIds = new WeakMap<RequestListener, number>()
const dispatcher = createServer((req, res) => {
	const [, id = '', ...path] = (req.url ?? '').split('/')
	req.url = `/${path.join('/')}`
	apps[Number(id)]?.(req, res)
})
let baseUrl = ''

vi.mock('supertest', async (importOriginal) => {
	const { default: original } = await importOriginal<{ default: typeof supertest }>()
	const urlFor = (app: RequestListener) => {
		let id = appIds.get(app)
		if (id === undefined) {
			id = apps.push(app) - 1
			appIds.set(app, id)
		}
		return `${baseUrl}/${id}`
	}
	return { default: (app: Parameters<typeof supertest>[0]) => original(typeof app === 'function' ? urlFor(app as RequestListener) : app) }
})

beforeAll(async () => {
	await new Promise<void>((resolve) => dispatcher.listen(0, '127.0.0.1', resolve))
	baseUrl = `http://127.0.0.1:${(dispatcher.address() as AddressInfo).port}`
})

beforeEach(async () => {
	await truncateAllTables()
})

afterAll(async () => {
	dispatcher.closeAllConnections()
	await new Promise((resolve) => dispatcher.close(resolve))
	await disconnectTestPrisma()
})
