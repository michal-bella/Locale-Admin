import { test as teardown } from '@playwright/test'

import { deleteTestEditors } from '../support/db'

teardown('delete test EDITOR users', async () => {
	const deleted = await deleteTestEditors()
	console.log(`Deleted ${deleted} test EDITOR user(s)`)
})
