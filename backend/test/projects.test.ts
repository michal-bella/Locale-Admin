import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { ERROR_CODE, ROLE, VALIDATION_CODE, errorResponseSchema, projectListItemSchema, projectListResponseSchema } from '@locale/shared'

import { createTestApp } from './helpers/app'
import { CSRF_HEADERS, loginAs } from './helpers/auth'
import { getTestPrisma } from './helpers/db'
import { TEST_PASSWORD, createUser } from './helpers/users'

type App = ReturnType<typeof createTestApp>

const expectErrorCode = (res: request.Response, status: number, code: ERROR_CODE) => {
	expect(res.status).toBe(status)
	expect(errorResponseSchema.parse(res.body).error.code).toBe(code)
}

const login = async (app: App, role: ROLE = ROLE.EDITOR) => {
	const { user } = await createUser({ role })
	return { user, cookie: await loginAs(app, { email: user.email, password: TEST_PASSWORD }) }
}

const createProjectRow = (name: string, slug: string, memberIds: string[] = []) =>
	getTestPrisma().project.create({ data: { name, slug, members: { create: memberIds.map((userId) => ({ userId })) } } })

const postProject = (app: App, cookie: string, body: unknown) =>
	request(app)
		.post('/api/projects')
		.set('Cookie', cookie)
		.set(CSRF_HEADERS)
		.send(body as object)

const leave = (app: App, cookie: string, projectId: string) =>
	request(app).delete(`/api/projects/${projectId}/membership`).set('Cookie', cookie).set(CSRF_HEADERS).send({})

describe('GET /api/projects', () => {
	it('returns only the projects of an EDITOR sorted by name', async () => {
		const app = createTestApp()
		const { user, cookie } = await login(app)
		const { user: colleague } = await createUser()
		const web = await createProjectRow('Booking Web', 'booking-web', [user.id, colleague.id])
		const admin = await createProjectRow('B2B Admin', 'b2b-admin', [user.id])
		await createProjectRow('Foreign', 'foreign')

		const res = await request(app).get('/api/projects').set('Cookie', cookie)

		expect(res.status).toBe(200)
		expect(projectListResponseSchema.extend({ projects: projectListItemSchema.strict().array() }).strict().parse(res.body).projects).toEqual([
			{
				id: admin.id,
				name: 'B2B Admin',
				slug: 'b2b-admin',
				primaryColor: '#E83E8C',
				isMember: true,
				languageTags: [],
				keyCount: 0,
				translatedCount: 0,
				memberCount: 1,
				createdAt: admin.createdAt.toISOString(),
			},
			{
				id: web.id,
				name: 'Booking Web',
				slug: 'booking-web',
				primaryColor: '#E83E8C',
				isMember: true,
				languageTags: [],
				keyCount: 0,
				translatedCount: 0,
				memberCount: 2,
				createdAt: web.createdAt.toISOString(),
			},
		])
	})

	it('returns the languages base first, the key count and the filled values of the project only', async () => {
		const app = createTestApp()
		const { user, cookie } = await login(app)
		const prisma = getTestPrisma()
		const project = await prisma.project.create({
			data: {
				name: 'Web',
				slug: 'web',
				members: { create: { userId: user.id } },
				languages: { create: [{ tag: 'sk' }, { tag: 'en', isBase: true }] },
			},
			include: { languages: true },
		})
		const languageId = (tag: string) => project.languages.find((language) => language.tag === tag)!.id
		const [sk, en] = [languageId('sk'), languageId('en')]
		await prisma.translationKey.create({
			data: {
				projectId: project.id,
				name: 'a',
				translations: {
					create: [
						{ languageId: en, value: 'A' },
						{ languageId: sk, value: 'A' },
					],
				},
			},
		})
		await prisma.translationKey.create({
			data: {
				projectId: project.id,
				name: 'b',
				translations: {
					create: [
						{ languageId: en, value: 'B' },
						{ languageId: sk, value: null },
					],
				},
			},
		})
		await prisma.translationKey.create({ data: { projectId: project.id, name: 'c' } })
		const other = await prisma.project.create({
			data: { name: 'Other', slug: 'other', languages: { create: { tag: 'en', isBase: true } } },
			include: { languages: true },
		})
		await prisma.translationKey.create({
			data: { projectId: other.id, name: 'a', translations: { create: { languageId: other.languages[0]!.id, value: 'A' } } },
		})

		const res = await request(app).get('/api/projects').set('Cookie', cookie)

		expect(projectListResponseSchema.parse(res.body).projects).toEqual([
			expect.objectContaining({ id: project.id, languageTags: ['en', 'sk'], keyCount: 3, translatedCount: 3 }),
		])
	})

	it('returns every project to an ADMIN with isMember per project', async () => {
		const app = createTestApp()
		const { user, cookie } = await login(app, ROLE.ADMIN)
		const own = await createProjectRow('A', 'a', [user.id])
		const foreign = await createProjectRow('B', 'b')

		const res = await request(app).get('/api/projects').set('Cookie', cookie)

		expect(projectListResponseSchema.parse(res.body).projects.map(({ id, isMember }) => ({ id, isMember }))).toEqual([
			{ id: own.id, isMember: true },
			{ id: foreign.id, isMember: false },
		])
	})

	it('returns 401 AUTH_UNAUTHENTICATED without a session', async () => {
		const res = await request(createTestApp()).get('/api/projects')

		expectErrorCode(res, 401, ERROR_CODE.AUTH_UNAUTHENTICATED)
	})
})

describe('POST /api/projects', () => {
	it('creates a project as an ADMIN with trimmed values and its languages and makes the creator a member', async () => {
		const app = createTestApp()
		const { user, cookie } = await login(app, ROLE.ADMIN)

		const res = await postProject(app, cookie, { name: ' Booking Web ', slug: ' booking-web ', languageTags: ['en', 'sk'] })

		expect(res.status).toBe(201)
		const body = projectListItemSchema.strict().parse(res.body)
		expect(body).toMatchObject({
			name: 'Booking Web',
			slug: 'booking-web',
			primaryColor: '#E83E8C',
			isMember: true,
			languageTags: ['en', 'sk'],
			keyCount: 0,
			translatedCount: 0,
			memberCount: 1,
		})
		expect(await getTestPrisma().projectMember.findMany({ where: { projectId: body.id }, select: { userId: true } })).toEqual([{ userId: user.id }])
		// The first chosen language is the base.
		expect(
			await getTestPrisma().projectLanguage.findMany({ where: { projectId: body.id }, select: { tag: true, isBase: true }, orderBy: { tag: 'asc' } }),
		).toEqual([
			{ tag: 'en', isBase: true },
			{ tag: 'sk', isBase: false },
		])
	})

	it('returns 400 VALIDATION_ERROR with details for an invalid body', async () => {
		const app = createTestApp()
		const { cookie } = await login(app, ROLE.ADMIN)

		const res = await postProject(app, cookie, { name: ' ', slug: 'Booking Web', languageTags: [] })

		expectErrorCode(res, 400, ERROR_CODE.VALIDATION_ERROR)
		expect(errorResponseSchema.parse(res.body).error.details).toEqual([
			{ path: 'name', code: VALIDATION_CODE.REQUIRED },
			{ path: 'slug', code: VALIDATION_CODE.INVALID },
			{ path: 'languageTags', code: VALIDATION_CODE.REQUIRED },
		])
		expect(await getTestPrisma().project.count()).toBe(0)
	})

	it('returns 409 SLUG_TAKEN for an existing slug', async () => {
		const app = createTestApp()
		const { cookie } = await login(app, ROLE.ADMIN)
		await createProjectRow('Booking Web', 'booking-web')

		const res = await postProject(app, cookie, { name: 'Other', slug: 'booking-web', languageTags: ['sk'] })

		expectErrorCode(res, 409, ERROR_CODE.SLUG_TAKEN)
		expect(await getTestPrisma().project.count()).toBe(1)
		expect(await getTestPrisma().projectLanguage.count()).toBe(0)
	})

	it('returns 403 FORBIDDEN for an EDITOR and creates nothing', async () => {
		const app = createTestApp()
		const { cookie } = await login(app)

		const res = await postProject(app, cookie, { name: 'Booking Web', slug: 'booking-web', languageTags: ['sk'] })

		expectErrorCode(res, 403, ERROR_CODE.FORBIDDEN)
		expect(await getTestPrisma().project.count()).toBe(0)
	})

	it('returns 401 AUTH_UNAUTHENTICATED without a session', async () => {
		const res = await request(createTestApp())
			.post('/api/projects')
			.set(CSRF_HEADERS)
			.send({ name: 'A', slug: 'a', languageTags: ['sk'] })

		expectErrorCode(res, 401, ERROR_CODE.AUTH_UNAUTHENTICATED)
	})

	it('returns 403 CSRF_REJECTED without X-Requested-With', async () => {
		const app = createTestApp()
		const { cookie } = await login(app, ROLE.ADMIN)

		const res = await request(app)
			.post('/api/projects')
			.set('Cookie', cookie)
			.send({ name: 'A', slug: 'a', languageTags: ['sk'] })

		expectErrorCode(res, 403, ERROR_CODE.CSRF_REJECTED)
		expect(await getTestPrisma().project.count()).toBe(0)
	})
})

describe('DELETE /api/projects/:projectId/membership', () => {
	it('removes the membership of the caller only', async () => {
		const app = createTestApp()
		const { user, cookie } = await login(app)
		const { user: other } = await createUser()
		const project = await createProjectRow('A', 'a', [user.id, other.id])

		const res = await leave(app, cookie, project.id)

		expect(res.status).toBe(204)
		expect(await getTestPrisma().projectMember.findMany({ where: { projectId: project.id }, select: { userId: true } })).toEqual([{ userId: other.id }])
	})

	it('returns 409 LAST_MEMBER for the last member', async () => {
		const app = createTestApp()
		const { user, cookie } = await login(app)
		const project = await createProjectRow('A', 'a', [user.id])

		const res = await leave(app, cookie, project.id)

		expectErrorCode(res, 409, ERROR_CODE.LAST_MEMBER)
		expect(await getTestPrisma().projectMember.count()).toBe(1)
	})

	it('lets only one of the last two members leave when they leave at the same time', async () => {
		const app = createTestApp()
		const first = await login(app)
		const second = await login(app)
		const project = await createProjectRow('A', 'a', [first.user.id, second.user.id])

		const statuses = (await Promise.all([leave(app, first.cookie, project.id), leave(app, second.cookie, project.id)])).map(({ status }) => status)

		expect(statuses.sort()).toEqual([204, 409])
		expect(await getTestPrisma().projectMember.count()).toBe(1)
	})

	it('returns 404 NOT_FOUND to an ADMIN who is not a member', async () => {
		const app = createTestApp()
		const { cookie } = await login(app, ROLE.ADMIN)
		const { user: member } = await createUser()
		const project = await createProjectRow('A', 'a', [member.id])

		const res = await leave(app, cookie, project.id)

		expectErrorCode(res, 404, ERROR_CODE.NOT_FOUND)
		expect(await getTestPrisma().projectMember.count()).toBe(1)
	})

	it('returns 404 NOT_FOUND to an EDITOR who is not a member', async () => {
		const app = createTestApp()
		const { cookie } = await login(app)
		const { user: member } = await createUser()
		const project = await createProjectRow('A', 'a', [member.id])

		const res = await leave(app, cookie, project.id)

		expectErrorCode(res, 404, ERROR_CODE.NOT_FOUND)
	})

	it('returns 403 FORBIDDEN to a VISITOR member and keeps the membership', async () => {
		const app = createTestApp()
		const { user, cookie } = await login(app, ROLE.VISITOR)
		const { user: other } = await createUser()
		const project = await createProjectRow('A', 'a', [user.id, other.id])

		const res = await leave(app, cookie, project.id)

		expectErrorCode(res, 403, ERROR_CODE.FORBIDDEN)
		expect(await getTestPrisma().projectMember.count({ where: { projectId: project.id } })).toBe(2)
	})

	it('returns 403 CSRF_REJECTED without X-Requested-With', async () => {
		const app = createTestApp()
		const { user, cookie } = await login(app)
		const { user: other } = await createUser()
		const project = await createProjectRow('A', 'a', [user.id, other.id])

		const res = await request(app).delete(`/api/projects/${project.id}/membership`).set('Cookie', cookie)

		expectErrorCode(res, 403, ERROR_CODE.CSRF_REJECTED)
		expect(await getTestPrisma().projectMember.count()).toBe(2)
	})
})

const putOrder = (app: App, cookie: string, body: unknown) =>
	request(app)
		.put('/api/projects/order')
		.set('Cookie', cookie)
		.set(CSRF_HEADERS)
		.send(body as object)

const listedIds = async (app: App, cookie: string) =>
	projectListResponseSchema.parse((await request(app).get('/api/projects').set('Cookie', cookie)).body).projects.map(({ id }) => id)

describe('PUT /api/projects/order', () => {
	it("stores the user's own order, lists unordered projects after it by name and leaves other users alone", async () => {
		const app = createTestApp()
		const { user, cookie } = await login(app)
		const other = await login(app)
		const a = await createProjectRow('Alpha', 'alpha', [user.id, other.user.id])
		const b = await createProjectRow('Beta', 'beta', [user.id, other.user.id])
		const c = await createProjectRow('Gamma', 'gamma', [user.id, other.user.id])

		const res = await putOrder(app, other.cookie, { projectIds: [c.id, a.id, b.id] })
		expect(res.status).toBe(204)
		expect(await listedIds(app, other.cookie)).toEqual([c.id, a.id, b.id])
		expect(await listedIds(app, cookie)).toEqual([a.id, b.id, c.id])

		expect((await putOrder(app, cookie, { projectIds: [b.id] })).status).toBe(204)
		const d = await createProjectRow('Delta', 'delta', [user.id])
		expect(await listedIds(app, cookie)).toEqual([b.id, a.id, d.id, c.id])
	})

	it('lets an ADMIN order projects they are not a member of', async () => {
		const app = createTestApp()
		const { cookie } = await login(app, ROLE.ADMIN)
		const a = await createProjectRow('Alpha', 'alpha')
		const b = await createProjectRow('Beta', 'beta')

		expect((await putOrder(app, cookie, { projectIds: [b.id, a.id] })).status).toBe(204)
		expect(await listedIds(app, cookie)).toEqual([b.id, a.id])
	})

	it('returns 404 NOT_FOUND for a project the EDITOR does not see and keeps the order', async () => {
		const app = createTestApp()
		const { user, cookie } = await login(app)
		const a = await createProjectRow('Alpha', 'alpha', [user.id])
		const b = await createProjectRow('Beta', 'beta', [user.id])
		const foreign = await createProjectRow('Foreign', 'foreign')
		await putOrder(app, cookie, { projectIds: [b.id, a.id] })

		expectErrorCode(await putOrder(app, cookie, { projectIds: [a.id, foreign.id] }), 404, ERROR_CODE.NOT_FOUND)
		expect(await listedIds(app, cookie)).toEqual([b.id, a.id])
	})

	it('returns 400 VALIDATION_ERROR for an empty list, duplicates or a non-uuid', async () => {
		const app = createTestApp()
		const { user, cookie } = await login(app)
		const a = await createProjectRow('Alpha', 'alpha', [user.id])

		for (const projectIds of [[], [a.id, a.id], ['x']]) {
			const res = await putOrder(app, cookie, { projectIds })
			expectErrorCode(res, 400, ERROR_CODE.VALIDATION_ERROR)
			expect(res.body).toMatchObject({ error: { details: [expect.objectContaining({ path: expect.stringMatching(/^projectIds/) as unknown })] } })
		}
	})

	it('returns 401 without a session and 403 CSRF_REJECTED without X-Requested-With', async () => {
		const app = createTestApp()
		const { cookie } = await login(app)
		expectErrorCode(await request(app).put('/api/projects/order').set(CSRF_HEADERS).send({ projectIds: [] }), 401, ERROR_CODE.AUTH_UNAUTHENTICATED)
		expectErrorCode(await request(app).put('/api/projects/order').set('Cookie', cookie).send({ projectIds: [] }), 403, ERROR_CODE.CSRF_REJECTED)
	})
})
