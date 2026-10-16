import { test as setup } from '@playwright/test'

import { ANONYMOUS, expectLoggedInHome, loginViaUi, STORAGE_STATE } from '../support/auth'
import { createEditor } from '../support/db'
import { ADMIN_EMAIL, getAdminPassword } from '../support/env'

setup.use({ storageState: ANONYMOUS })

setup('log in as ADMIN', async ({ page }) => {
	await loginViaUi(page, { email: ADMIN_EMAIL, password: getAdminPassword() })
	await expectLoggedInHome(page)
	await page.context().storageState({ path: STORAGE_STATE.ADMIN })
})

setup('log in as EDITOR', async ({ page }) => {
	await loginViaUi(page, await createEditor())
	await expectLoggedInHome(page)
	await page.context().storageState({ path: STORAGE_STATE.EDITOR })
})
