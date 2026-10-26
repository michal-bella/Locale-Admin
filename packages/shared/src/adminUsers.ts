import { z } from 'zod'

import { PROJECT_ROLE, ROLE } from './auth'
import { emailSchema } from './email'
import { passwordSchema } from './password'

/** Body of `POST /api/admin/users`. The only way to create a user; members of projects are added from existing users. */
export const createUserRequestSchema = z.object({
	email: emailSchema,
	password: passwordSchema,
	role: z.enum(ROLE),
})

export type CreateUserRequest = z.infer<typeof createUserRequestSchema>

/**
 * Body of `PATCH /api/admin/users/:id`: changes the global role, the email, the block or any of them. The last `ADMIN` cannot become a `USER`,
 * nobody blocks their own account (`isActive: false` signs the user out everywhere).
 */
export const updateUserRequestSchema = z
	.object({
		role: z.enum(ROLE).optional(),
		email: emailSchema.optional(),
		isActive: z.boolean().optional(),
	})
	.refine(({ role, email, isActive }) => role !== undefined || email !== undefined || isActive !== undefined)

export type UpdateUserRequest = z.infer<typeof updateUserRequestSchema>

/** Body of `PUT /api/admin/users/:id/password`: sets a new password (also for a user who signs in only with Google) and signs the user out everywhere. */
export const setUserPasswordRequestSchema = z.object({
	password: passwordSchema,
})

export type SetUserPasswordRequest = z.infer<typeof setUserPasswordRequestSchema>

/**
 * One user in the admin list and the body of `201 POST /api/admin/users`. Never contains `passwordHash`. `isActive: false` is a blocked user,
 * `hasPassword` and `hasGoogle` are the sign-in methods.
 */
export const adminUserSchema = z.object({
	id: z.uuid(),
	email: z.email(),
	role: z.enum(ROLE),
	isActive: z.boolean(),
	hasPassword: z.boolean(),
	hasGoogle: z.boolean(),
	projectCount: z.number().int(),
	lastLoginAt: z.iso.datetime().nullable(),
	createdAt: z.iso.datetime(),
})

export type AdminUser = z.infer<typeof adminUserSchema>

/** Body of `GET /api/admin/users`: every user (ADMIN and USER), sorted newest first. */
export const adminUserListResponseSchema = z.object({
	users: z.array(adminUserSchema),
})

export type AdminUserListResponse = z.infer<typeof adminUserListResponseSchema>

/** One project of a user in `GET /api/admin/users/:id`. `role` is the role of the membership, `joinedAt` is when the user became a member. */
export const adminUserProjectSchema = z.object({
	id: z.uuid(),
	name: z.string(),
	slug: z.string(),
	primaryColor: z.string(),
	role: z.enum(PROJECT_ROLE),
	joinedAt: z.iso.datetime(),
})

export type AdminUserProject = z.infer<typeof adminUserProjectSchema>

/** Body of `GET /api/admin/users/:id`: the user with the projects they are a member of, sorted by name. */
export const adminUserDetailSchema = adminUserSchema.extend({
	projects: z.array(adminUserProjectSchema),
})

export type AdminUserDetail = z.infer<typeof adminUserDetailSchema>
