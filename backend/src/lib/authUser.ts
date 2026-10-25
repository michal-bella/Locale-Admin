import { PROJECT_ROLE, ROLE, type AuthUser, type TranslationsLayout, type TranslationsView } from '@locale/shared'

import { type User } from '../generated/prisma/client'
import { PROJECT_ROLE as PRISMA_PROJECT_ROLE, ROLE as PRISMA_ROLE, type TRANSLATIONS_LAYOUT, type TRANSLATIONS_VIEW } from '../generated/prisma/enums'

export const ROLE_FROM_PRISMA: Record<PRISMA_ROLE, ROLE> = {
	ADMIN: ROLE.ADMIN,
	USER: ROLE.USER,
}

export const ROLE_TO_PRISMA: Record<ROLE, PRISMA_ROLE> = {
	[ROLE.ADMIN]: PRISMA_ROLE.ADMIN,
	[ROLE.USER]: PRISMA_ROLE.USER,
}

export const PROJECT_ROLE_FROM_PRISMA: Record<PRISMA_PROJECT_ROLE, PROJECT_ROLE> = {
	MANAGER: PROJECT_ROLE.MANAGER,
	EDITOR: PROJECT_ROLE.EDITOR,
	VISITOR: PROJECT_ROLE.VISITOR,
}

export const PROJECT_ROLE_TO_PRISMA: Record<PROJECT_ROLE, PRISMA_PROJECT_ROLE> = {
	[PROJECT_ROLE.MANAGER]: PRISMA_PROJECT_ROLE.MANAGER,
	[PROJECT_ROLE.EDITOR]: PRISMA_PROJECT_ROLE.EDITOR,
	[PROJECT_ROLE.VISITOR]: PRISMA_PROJECT_ROLE.VISITOR,
}

export const TRANSLATIONS_VIEW_FROM_PRISMA: Record<TRANSLATIONS_VIEW, TranslationsView> = {
	EXTENDED: 'EXTENDED',
	COMPACT: 'COMPACT',
}

export const TRANSLATIONS_LAYOUT_FROM_PRISMA: Record<TRANSLATIONS_LAYOUT, TranslationsLayout> = {
	COLUMNS: 'COLUMNS',
	STACKED: 'STACKED',
}

export type AuthUserRow = Pick<User, 'id' | 'email' | 'role' | 'firstName' | 'lastName' | 'translationsView' | 'translationsLayout'>

export const toAuthUser = (user: AuthUserRow): AuthUser => ({
	id: user.id,
	email: user.email,
	role: ROLE_FROM_PRISMA[user.role],
	firstName: user.firstName,
	lastName: user.lastName,
	preferences: {
		translationsView: TRANSLATIONS_VIEW_FROM_PRISMA[user.translationsView],
		translationsLayout: TRANSLATIONS_LAYOUT_FROM_PRISMA[user.translationsLayout],
	},
})
