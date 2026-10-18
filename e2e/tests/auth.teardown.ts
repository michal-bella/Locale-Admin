import { test as teardown } from '@playwright/test'

import { deleteTestProjects, deleteTestUsers } from '../support/db'

teardown('delete test users and projects', async () => {
	const users = await deleteTestUsers()
	const projects = await deleteTestProjects()
	console.log(`Deleted ${users} test user(s) and ${projects} test project(s)`)
})
