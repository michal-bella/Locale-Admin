import { test as setup } from '@playwright/test'

import { ANONYMOUS, expectLoggedInHome, loginViaUi, STORAGE_STATE } from '../support/auth'
import { ADMIN_EMAIL, getAdminPassword } from '../support/env'
import { createEditor } from '../support/users'

setup.use({ storageState: ANONYMOUS })
// The EDITOR is created through the API with the ADMIN storage state saved by the first test.
setup.describe.configure({ mode: 'serial' })

setup('log in as ADMIN', async ({ page }) => {
	await loginViaUi(page, { email: ADMIN_EMAIL, password: getAdminPassword() })
	await expectLoggedInHome(page)
	await page.context().storageState({ path: STORAGE_STATE.ADMIN })
})

setup('log in as EDITOR', async ({ page, playwright, baseURL }) => {
	await loginViaUi(page, await createEditor(playwright.request, baseURL))
	await expectLoggedInHome(page)
	await page.context().storageState({ path: STORAGE_STATE.EDITOR })
})
