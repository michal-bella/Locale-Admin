import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		include: ['test/**/*.test.ts'],
		globalSetup: ['test/globalSetup.ts'],
		setupFiles: ['test/setup.ts'],
		fileParallelism: false,
		testTimeout: 20000,
		hookTimeout: 60000,
	},
})
