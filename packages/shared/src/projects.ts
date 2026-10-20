import { z } from 'zod'

import { ROLE } from './auth'
import { LANGUAGE_TAGS } from './languages'
import { projectNameSchema, projectSlugSchema } from './projectSettings'

/** Body of `POST /api/projects`. The creator becomes a member; the first of `languageTags` is the base language. */
export const createProjectRequestSchema = z.object({
	name: projectNameSchema,
	slug: projectSlugSchema,
	languageTags: z
		.array(z.enum(LANGUAGE_TAGS))
		.min(1)
		.refine((tags) => new Set(tags).size === tags.length),
})

export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>

/**
 * One project on the index page and the body of `201 POST /api/projects`. `isMember` is `false` only for an ADMIN outside the project.
 * `languageTags` start with the base language; `translatedCount` is the number of filled values over all keys and languages, so the
 * project is fully translated when it equals `keyCount * languageTags.length`. `memberCount` counts every member of the project.
 */
export const projectListItemSchema = z.object({
	id: z.uuid(),
	name: z.string(),
	slug: z.string(),
	primaryColor: z.string(),
	isMember: z.boolean(),
	languageTags: z.array(z.enum(LANGUAGE_TAGS)),
	keyCount: z.number().int().nonnegative(),
	translatedCount: z.number().int().nonnegative(),
	memberCount: z.number().int().nonnegative(),
	createdAt: z.iso.datetime(),
})

export type ProjectListItem = z.infer<typeof projectListItemSchema>

/**
 * Body of `GET /api/projects` in the user's own order (`PUT /api/projects/order`), projects without a position after them by name. An ADMIN
 * gets every project, an EDITOR only projects they are a member of.
 */
export const projectListResponseSchema = z.object({
	projects: z.array(projectListItemSchema),
})

export type ProjectListResponse = z.infer<typeof projectListResponseSchema>

/** Body of `POST /api/projects/:projectId/members`: adds an existing user to the project. ADMIN only. */
export const addProjectMemberRequestSchema = z.object({
	userId: z.uuid(),
})

export type AddProjectMemberRequest = z.infer<typeof addProjectMemberRequestSchema>

/**
 * One member in `GET /api/projects/:projectId/members` and the body of `201 POST`. `role` is the global role and
 * `projectCount` the number of projects the user is a member of (as on `/admin/users`); `createdAt` is when the user
 * joined the project.
 */
export const projectMemberSchema = z.object({
	id: z.uuid(),
	email: z.email(),
	firstName: z.string().nullable(),
	lastName: z.string().nullable(),
	role: z.enum(ROLE),
	projectCount: z.number().int(),
	createdAt: z.iso.datetime(),
})

export type ProjectMember = z.infer<typeof projectMemberSchema>

/** Body of `GET /api/projects/:projectId/members`, oldest member first. */
export const projectMemberListResponseSchema = z.object({
	members: z.array(projectMemberSchema),
})

export type ProjectMemberListResponse = z.infer<typeof projectMemberListResponseSchema>

export const PROJECT_ORDER_MAX = 1000

/** Body of `PUT /api/projects/order`: every project the user sees, in the new order. The order is the user's own. */
export const reorderProjectsRequestSchema = z.object({
	projectIds: z
		.array(z.uuid())
		.min(1)
		.max(PROJECT_ORDER_MAX)
		.refine((ids) => new Set(ids).size === ids.length),
})

export type ReorderProjectsRequest = z.infer<typeof reorderProjectsRequestSchema>
