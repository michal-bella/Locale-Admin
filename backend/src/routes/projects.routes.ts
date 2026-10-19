import { Router } from 'express'

import { ROLE } from '@locale/shared'

import { type Config } from '../config/env'
import { createImportController, createPreviewImportController } from '../controllers/imports.controller'
import {
	createCreateProjectLanguageController,
	createDeleteProjectLanguageController,
	createListProjectLanguagesController,
} from '../controllers/projectLanguages.controller'
import {
	createAddProjectMemberController,
	createListProjectMembersController,
	createRemoveProjectMemberController,
} from '../controllers/projectMembers.controller'
import { createGetProjectSettingsController, createUpdateProjectSettingsController } from '../controllers/projectSettings.controller'
import { createCreateProjectController, createLeaveProjectController, createListProjectsController } from '../controllers/projects.controller'
import {
	createListTranslationsController,
	createUpdateTranslationController,
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
	router.post('/', createCreateProjectController(prisma))
	router.delete('/:projectId/membership', requireProjectAccess, createLeaveProjectController(prisma))
	router.get('/:projectId/settings', requireProjectAccess, createGetProjectSettingsController(prisma))
	router.patch('/:projectId/settings', requireProjectAccess, createUpdateProjectSettingsController(prisma))
	router.get('/:projectId/languages', requireProjectAccess, createListProjectLanguagesController(prisma))
	router.post('/:projectId/languages', requireProjectAccess, createCreateProjectLanguageController(prisma))
	router.delete('/:projectId/languages/:languageId', requireProjectAccess, createDeleteProjectLanguageController(prisma))
	router.get('/:projectId/members', requireProjectAccess, createListProjectMembersController(prisma))
	router.post('/:projectId/members', requireProjectAccess, requireRole(ROLE.ADMIN), createAddProjectMemberController(prisma))
	router.delete('/:projectId/members/:userId', requireProjectAccess, requireRole(ROLE.ADMIN), createRemoveProjectMemberController(prisma))
	router.get('/:projectId/translations', requireProjectAccess, createListTranslationsController(prisma))
	router.put('/:projectId/keys/:keyId/translations/:languageId', requireProjectAccess, createUpdateTranslationController(prisma))
	router.patch('/:projectId/keys/:keyId', requireProjectAccess, requireRole(ROLE.ADMIN), createUpdateTranslationKeyController(prisma))
	// The default JSON parser skips /imports*: every route under this prefix gets the 12 MB parser, after the access check.
	router.use('/:projectId/imports', requireProjectAccess, importJsonBody)
	router.post('/:projectId/imports', createImportController(prisma))
	router.post('/:projectId/imports/preview', createPreviewImportController(prisma))
	return router
}
