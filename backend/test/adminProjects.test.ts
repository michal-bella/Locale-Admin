import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { ERROR_CODE, ROLE, adminProjectListItemSchema, adminProjectListResponseSchema, errorResponseSchema } from '@locale/shared'

import { createTestApp } from './helpers/app'
import { CSRF_HEADERS, loginAs } from './helpers/auth'
import { getTestPrisma } from './helpers/db'
import { TEST_PASSWORD, createUser } from './helpers/users'

type App = ReturnType<typeof createTestApp>

const expectErrorCode = (res: request.Response, status: number, code: ERROR_CODE) => {
	expect(res.status).toBe(status)
	expect(errorResponseSchema.parse(res.body).error.code).toBe(code)
}

const loginWithRole = async (app: App, role: ROLE) => {
	const { user } = await createUser({ role })
	return { user, cookie: await loginAs(app, { email: user.email, password: TEST_PASSWORD }) }
}

const createProject = (data: { name: string; slug: string; createdAt?: Date; memberIds?: string[]; languageTags?: string[] }) =>
	getTestPrisma().project.create({
		data: {
			name: data.name,
			slug: data.slug,
			createdAt: data.createdAt,
			members: { create: (data.memberIds ?? []).map((userId) => ({ userId })) },
			languages: { create: (data.languageTags ?? []).map((tag, index) => ({ tag, isBase: index === 0 })) },
		},
	})

const deleteProject = (app: App, cookie: string, id: string) =>
	request(app).delete(`/api/admin/projects/${id}`).set('Cookie', cookie).set(CSRF_HEADERS).send({})

describe('GET /api/admin/projects', () => {
	it('returns every project sorted by name with counts and the base language', async () => {
		const app = createTestApp()
		const { cookie } = await loginWithRole(app, ROLE.ADMIN)
		const { user: editor } = await createUser()
		const { user: otherEditor } = await createUser()
		const web = await createProject({
			name: 'Web',
			slug: 'web',
			createdAt: new Date('2026-02-01T00:00:00Z'),
			memberIds: [editor.id, otherEditor.id],
			languageTags: ['sk', 'en', 'cs'],
		})
		const android = await createProject({ name: 'Android', slug: 'android', createdAt: new Date('2026-03-01T00:00:00Z'), languageTags: ['en'] })
		const empty = await createProject({ name: 'Bez jazykov', slug: 'bez-jazykov', createdAt: new Date('2026-01-01T00:00:00Z'), memberIds: [editor.id] })

		const res = await request(app).get('/api/admin/projects').set('Cookie', cookie)

		expect(res.status).toBe(200)
		expect(adminProjectListResponseSchema.extend({ projects: adminProjectListItemSchema.strict().array() }).strict().safeParse(res.body).success).toBe(true)
		const { projects } = adminProjectListResponseSchema.parse(res.body)
		expect(projects).toEqual([
			{
				id: android.id,
				name: 'Android',
				slug: 'android',
				primaryColor: android.primaryColor,
				baseLanguageTag: 'en',
				languageCount: 1,
				memberCount: 0,
				createdAt: '2026-03-01T00:00:00.000Z',
			},
			{
				id: empty.id,
				name: 'Bez jazykov',
				slug: 'bez-jazykov',
				primaryColor: empty.primaryColor,
				baseLanguageTag: null,
				languageCount: 0,
				memberCount: 1,
				createdAt: '2026-01-01T00:00:00.000Z',
			},
			{
				id: web.id,
				name: 'Web',
				slug: 'web',
				primaryColor: web.primaryColor,
				baseLanguageTag: 'sk',
				languageCount: 3,
				memberCount: 2,
				createdAt: '2026-02-01T00:00:00.000Z',
			},
		])
	})

	it('sorts projects with the same name by id', async () => {
		const app = createTestApp()
		const { cookie } = await loginWithRole(app, ROLE.ADMIN)
		const first = await createProject({ name: 'Rovnaký', slug: 'rovnaky-1' })
		const second = await createProject({ name: 'Rovnaký', slug: 'rovnaky-2' })

		const res = await request(app).get('/api/admin/projects').set('Cookie', cookie)

		expect(res.status).toBe(200)
		expect(adminProjectListResponseSchema.parse(res.body).projects.map(({ id }) => id)).toEqual([first.id, second.id].sort())
	})

	it('returns 401 AUTH_UNAUTHENTICATED without a session', async () => {
		const res = await request(createTestApp()).get('/api/admin/projects')

		expectErrorCode(res, 401, ERROR_CODE.AUTH_UNAUTHENTICATED)
	})

	it('returns 403 FORBIDDEN for an EDITOR', async () => {
		const app = createTestApp()
		const { user, cookie } = await loginWithRole(app, ROLE.EDITOR)
		await createProject({ name: 'Web', slug: 'web', memberIds: [user.id] })

		const res = await request(app).get('/api/admin/projects').set('Cookie', cookie)

		expectErrorCode(res, 403, ERROR_CODE.FORBIDDEN)
	})
})

describe('DELETE /api/admin/projects/:projectId', () => {
	it('deletes the project with its members and languages and keeps the users', async () => {
		const app = createTestApp()
		const { cookie } = await loginWithRole(app, ROLE.ADMIN)
		const { user: editor } = await createUser()
		const project = await createProject({ name: 'Web', slug: 'web', memberIds: [editor.id], languageTags: ['sk', 'en'] })
		const other = await createProject({ name: 'iOS', slug: 'ios', memberIds: [editor.id], languageTags: ['sk'] })

		const res = await deleteProject(app, cookie, project.id)

		expect(res.status).toBe(204)
		expect(res.text).toBe('')
		const prisma = getTestPrisma()
		expect(await prisma.project.findMany({ select: { id: true } })).toEqual([{ id: other.id }])
		expect(await prisma.projectMember.count({ where: { projectId: project.id } })).toBe(0)
		expect(await prisma.projectLanguage.count({ where: { projectId: project.id } })).toBe(0)
		expect(await prisma.projectMember.count({ where: { projectId: other.id } })).toBe(1)
		expect(await prisma.projectLanguage.count({ where: { projectId: other.id } })).toBe(1)
		expect(await prisma.user.count({ where: { id: editor.id } })).toBe(1)
	})

	it.each([
		{ name: 'an unknown id', id: '00000000-0000-4000-8000-000000000999' },
		{ name: 'an id that is not a UUID', id: 'not-a-uuid' },
	])('returns 404 NOT_FOUND for $name', async ({ id }) => {
		const app = createTestApp()
		const { cookie } = await loginWithRole(app, ROLE.ADMIN)
		await createProject({ name: 'Web', slug: 'web' })

		const res = await deleteProject(app, cookie, id)

		expectErrorCode(res, 404, ERROR_CODE.NOT_FOUND)
		expect(await getTestPrisma().project.count()).toBe(1)
	})

	it('returns 404 NOT_FOUND for the second of two deletes of the same project', async () => {
		const app = createTestApp()
		const { cookie } = await loginWithRole(app, ROLE.ADMIN)
		const project = await createProject({ name: 'Web', slug: 'web' })

		const responses = await Promise.all([deleteProject(app, cookie, project.id), deleteProject(app, cookie, project.id)])

		expect(responses.map(({ status }) => status).sort()).toEqual([204, 404])
	})

	it('returns 401 AUTH_UNAUTHENTICATED without a session', async () => {
		const project = await createProject({ name: 'Web', slug: 'web' })

		const res = await request(createTestApp()).delete(`/api/admin/projects/${project.id}`).set(CSRF_HEADERS).send({})

		expectErrorCode(res, 401, ERROR_CODE.AUTH_UNAUTHENTICATED)
		expect(await getTestPrisma().project.count()).toBe(1)
	})

	it('returns 403 FORBIDDEN for an EDITOR, even a member of the project', async () => {
		const app = createTestApp()
		const { user, cookie } = await loginWithRole(app, ROLE.EDITOR)
		const project = await createProject({ name: 'Web', slug: 'web', memberIds: [user.id] })

		const res = await deleteProject(app, cookie, project.id)

		expectErrorCode(res, 403, ERROR_CODE.FORBIDDEN)
		expect(await getTestPrisma().project.count()).toBe(1)
	})

	it('returns 403 CSRF_REJECTED without X-Requested-With', async () => {
		const app = createTestApp()
		const { cookie } = await loginWithRole(app, ROLE.ADMIN)
		const project = await createProject({ name: 'Web', slug: 'web' })

		const res = await request(app).delete(`/api/admin/projects/${project.id}`).set('Cookie', cookie).send({})

		expectErrorCode(res, 403, ERROR_CODE.CSRF_REJECTED)
		expect(await getTestPrisma().project.count()).toBe(1)
	})
})
