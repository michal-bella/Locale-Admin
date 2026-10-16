import { afterAll, beforeEach } from 'vitest'

import { disconnectTestPrisma, truncateAllTables } from './helpers/db'

beforeEach(async () => {
	await truncateAllTables()
})

afterAll(async () => {
	await disconnectTestPrisma()
})
