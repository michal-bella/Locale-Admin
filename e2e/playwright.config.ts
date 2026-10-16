import { defineConfig, devices } from '@playwright/test'

import { STORAGE_STATE } from './support/auth'
import { BASE_URL } from './support/env'

export default defineConfig({
	testDir: './tests',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: 0,
	timeout: 30_000,
	expect: { timeout: 5_000 },
	reporter: [['list'], ['html', { open: 'never' }]],
	use: {
		baseURL: BASE_URL,
		trace: 'retain-on-failure',
		actionTimeout: 10_000,
		navigationTimeout: 15_000,
	},
	projects: [
		{ name: 'setup', testMatch: /.*\.setup\.ts/ },
		{ name: 'chromium', use: { ...devices['Desktop Chrome'], storageState: STORAGE_STATE.ADMIN }, dependencies: ['setup'] },
		{ name: 'webkit', use: { ...devices['Desktop Safari'], storageState: STORAGE_STATE.ADMIN }, dependencies: ['setup'] },
	],
})
