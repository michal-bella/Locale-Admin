import { z } from 'zod'

import { emailSchema } from './email'
import { PASSWORD_MAX_LENGTH } from './password'

/** Global role stored on `User.role`. Project roles are a different concept (later phases). */
export enum ROLE {
	ADMIN = 'ADMIN',
	EDITOR = 'EDITOR',
}

/** Login only requires a password; the rules for new passwords would turn a wrong password into a 400 instead of a 401. */
export const loginRequestSchema = z.object({
	email: emailSchema,
	password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
})

export type LoginRequest = z.infer<typeof loginRequestSchema>

/** Body of `GET /api/auth/me` and `POST /api/auth/login`. */
export const authUserSchema = z.object({
	id: z.uuid(),
	email: z.email(),
	role: z.enum(ROLE),
	firstName: z.string().nullable(),
	lastName: z.string().nullable(),
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
