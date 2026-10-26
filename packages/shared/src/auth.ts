import { z } from 'zod'

import { emailSchema } from './email'
import { PASSWORD_MAX_LENGTH } from './password'
import { translationsLayoutSchema, translationsViewSchema } from './translations'

/** Global role stored on `User.role`. `ADMIN` manages everything and works in every project without a membership; a `USER` works only in the projects they are a member of, with the role of that membership (`PROJECT_ROLE`). */
export enum ROLE {
	ADMIN = 'ADMIN',
	USER = 'USER',
}

/**
 * Role of a member in one project, stored on `ProjectMember.role` and set by an ADMIN. `MANAGER` has the rights of an ADMIN in the project
 * but no administration (users, projects, members), `EDITOR` translates, `VISITOR` only reads, filters and exports translations.
 */
export enum PROJECT_ROLE {
	MANAGER = 'MANAGER',
	EDITOR = 'EDITOR',
	VISITOR = 'VISITOR',
}

/** What a user may do in one project: `ADMIN` for an admin (no membership), otherwise the role of their membership. */
export type ProjectAccessRole = ROLE.ADMIN | PROJECT_ROLE

export const projectAccessRoleSchema = z.union([z.literal(ROLE.ADMIN), z.enum(PROJECT_ROLE)])

/** ADMIN and MANAGER manage a project they can open: settings, languages, versions, imports and keys. Members stay ADMIN only. */
export const canManageProject = (role: ProjectAccessRole): boolean => role === ROLE.ADMIN || role === PROJECT_ROLE.MANAGER

/** Login only requires a password; the rules for new passwords would turn a wrong password into a 400 instead of a 401. */
export const loginRequestSchema = z.object({
	email: emailSchema,
	password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
})

export type LoginRequest = z.infer<typeof loginRequestSchema>

/** Choices of the user that every screen needs on load; changed with `PATCH /api/profile/preferences`. */
export const userPreferencesSchema = z.object({
	translationsView: translationsViewSchema,
	translationsLayout: translationsLayoutSchema,
})

export type UserPreferences = z.infer<typeof userPreferencesSchema>

/** Body of `GET /api/auth/me` and `POST /api/auth/login`. */
export const authUserSchema = z.object({
	id: z.uuid(),
	email: z.email(),
	role: z.enum(ROLE),
	firstName: z.string().nullable(),
	lastName: z.string().nullable(),
	preferences: userPreferencesSchema,
})

export type AuthUser = z.infer<typeof authUserSchema>

/** Avatar initials: first letters of first and last name, otherwise the first two letters of the email. */
export const getInitials = ({ email, firstName, lastName }: Pick<AuthUser, 'email' | 'firstName' | 'lastName'>): string => {
	const first = firstName?.trim().charAt(0) ?? ''
	const last = lastName?.trim().charAt(0) ?? ''
	if (first && last) {
		return `${first}${last}`.toUpperCase()
	}
	return email.slice(0, 2).toUpperCase()
}
