import { Router } from 'express'

import { ROLE } from '@locale/shared'

import { type Config } from '../config/env'
import { createGetActivityDailyController, createListActivityController } from '../controllers/activity.controller'
import { createGetDashboardController } from '../controllers/dashboard.controller'
import { createExportCheckController, createExportController } from '../controllers/exports.controller'
import { createImportController, createPreviewImportController } from '../controllers/imports.controller'
import {
	createCreateProjectLanguageController,
	createDeleteProjectLanguageController,
	createListProjectLanguagesController,
	createReorderProjectLanguagesController,
} from '../controllers/projectLanguages.controller'
import {
	createAddProjectMemberController,
	createListProjectMembersController,
	createRemoveProjectMemberController,
} from '../controllers/projectMembers.controller'
import { createGetProjectSettingsController, createUpdateProjectSettingsController } from '../controllers/projectSettings.controller'
import {
	createCreateProjectController,
	createLeaveProjectController,
	createListProjectsController,
	createReorderProjectsController,
} from '../controllers/projects.controller'
import {
	createListTranslationsController,
	createUpdateTranslationController,
	createCreateTranslationKeyController,
	createUpdateTranslationKeyController,
} from '../controllers/translations.controller'
import { type PrismaClient } from '../lib/prisma'
import { createRequireAuth, requireRole } from '../middleware/auth.middleware'
import { importJsonBody } from '../middleware/jsonBody.middleware'
import { createRequireProjectAccess } from '../middleware/projectAccess.middleware'

export const createProjectsRouter = (prisma: PrismaClient, config: Config): Router => {
	const router = Router()
	const requireProjectAccess = createRequireProjectAccess(prisma)
	router.use(createRequireAuth(prisma, config))
	router.get('/', createListProjectsController(prisma))
	router.post('/', requireRole(ROLE.ADMIN), createCreateProjectController(prisma))
	router.put('/order', createReorderProjectsController(prisma))
	router.delete('/:projectId/membership', requireProjectAccess, createLeaveProjectController(prisma))
	router.get('/:projectId/settings', requireProjectAccess, createGetProjectSettingsController(prisma))
	router.patch('/:projectId/settings', requireProjectAccess, requireRole(ROLE.ADMIN), createUpdateProjectSettingsController(prisma))
	router.get('/:projectId/languages', requireProjectAccess, createListProjectLanguagesController(prisma))
	router.post('/:projectId/languages', requireProjectAccess, requireRole(ROLE.ADMIN), createCreateProjectLanguageController(prisma))
	router.put('/:projectId/languages/order', requireProjectAccess, requireRole(ROLE.ADMIN), createReorderProjectLanguagesController(prisma))
	router.delete('/:projectId/languages/:languageId', requireProjectAccess, requireRole(ROLE.ADMIN), createDeleteProjectLanguageController(prisma))
	router.get('/:projectId/members', requireProjectAccess, createListProjectMembersController(prisma))
	router.post('/:projectId/members', requireProjectAccess, requireRole(ROLE.ADMIN), createAddProjectMemberController(prisma))
	router.delete('/:projectId/members/:userId', requireProjectAccess, requireRole(ROLE.ADMIN), createRemoveProjectMemberController(prisma))
	router.get('/:projectId/dashboard', requireProjectAccess, createGetDashboardController(prisma))
	router.get('/:projectId/activity', requireProjectAccess, createListActivityController(prisma))
	router.get('/:projectId/activity/daily', requireProjectAccess, createGetActivityDailyController(prisma))
	router.get('/:projectId/translations', requireProjectAccess, createListTranslationsController(prisma))
	router.put('/:projectId/keys/:keyId/translations/:languageId', requireProjectAccess, createUpdateTranslationController(prisma))
	router.post('/:projectId/keys', requireProjectAccess, requireRole(ROLE.ADMIN), createCreateTranslationKeyController(prisma))
	router.patch('/:projectId/keys/:keyId', requireProjectAccess, requireRole(ROLE.ADMIN), createUpdateTranslationKeyController(prisma))
	router.get('/:projectId/export', requireProjectAccess, createExportController(prisma, config))
	router.get('/:projectId/export/check', requireProjectAccess, createExportCheckController(prisma))
	// The default JSON parser skips /imports*: every route under this prefix gets the 12 MB parser, after the access and role check.
	router.use('/:projectId/imports', requireProjectAccess, requireRole(ROLE.ADMIN), importJsonBody)
	router.post('/:projectId/imports', createImportController(prisma))
	router.post('/:projectId/imports/preview', createPreviewImportController(prisma))
	return router
}
