import { expect, test } from '@playwright/test'

import { ANONYMOUS } from '../support/auth'

const GOOGLE_FONTS = /fonts\.(googleapis|gstatic)\.com/

for (const { name, path, storageState } of [
	{ name: 'login page', path: '/login', storageState: ANONYMOUS },
	{ name: 'app layout', path: '/admin/users', storageState: undefined },
]) {
	test.describe(name, () => {
		if (storageState) {
			test.use({ storageState })
		}

		test('loads no Google Fonts and serves DM Sans locally', async ({ page, baseURL }) => {
			const requests: string[] = []
			page.on('request', (request) => requests.push(request.url()))

			await page.goto(path)
			await page.waitForLoadState('networkidle')
			await page.evaluate(() => document.fonts.ready)

			expect(requests.filter((url) => GOOGLE_FONTS.test(url))).toEqual([])
			const fontFiles = requests.filter((url) => /\.woff2?(\?|$)/.test(url))
			expect(fontFiles.length).toBeGreaterThan(0)
			expect(fontFiles.every((url) => url.startsWith(baseURL!))).toBe(true)
		})
	})
}
