import { randomUUID } from 'node:crypto'

import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { ERROR_CODE, ROLE, VALIDATION_CODE, errorResponseSchema, languageSchema, languagesResponseSchema, type LanguageTag } from '@locale/shared'

import { createTestApp } from './helpers/app'
import { CSRF_HEADERS, loginAs } from './helpers/auth'
import { getTestPrisma } from './helpers/db'
import { TEST_PASSWORD, createUser } from './helpers/users'

type App = ReturnType<typeof createTestApp>

const expectErrorCode = (res: request.Response, status: number, code: ERROR_CODE) => {
	expect(res.status).toBe(status)
	expect(errorResponseSchema.parse(res.body).error.code).toBe(code)
}

/** Logs in a new user who is a member of a new project. */
const loginToProject = async (app: App, role: ROLE = ROLE.EDITOR, { member = true }: { member?: boolean } = {}) => {
	const { user } = await createUser({ role })
	const project = await getTestPrisma().project.create({
		data: { name: 'A', slug: `a-${randomUUID().slice(0, 8)}`, members: member ? { create: { userId: user.id } } : undefined },
	})
	return { project, cookie: await loginAs(app, { email: user.email, password: TEST_PASSWORD }) }
}

const createLanguageRow = (projectId: string, tag: LanguageTag, isBase = false) => getTestPrisma().projectLanguage.create({ data: { projectId, tag, isBase } })

const languagesUrl = (projectId: string) => `/api/projects/${projectId}/languages`

const postLanguage = (app: App, cookie: string, projectId: string, body: unknown) =>
	request(app)
		.post(languagesUrl(projectId))
		.set('Cookie', cookie)
		.set(CSRF_HEADERS)
		.send(body as object)

const deleteLanguage = (app: App, cookie: string, projectId: string, id: string) =>
	request(app)
		.delete(`${languagesUrl(projectId)}/${id}`)
		.set('Cookie', cookie)
		.set(CSRF_HEADERS)
		.send({})

describe('GET /api/projects/:projectId/languages', () => {
	it('returns only the languages of the project, the base first, then by tag, with names and flag from the catalog', async () => {
		const app = createTestApp()
		const { project, cookie } = await loginToProject(app)
		const other = await getTestPrisma().project.create({ data: { name: 'B', slug: 'b' } })
		await createLanguageRow(project.id, 'sk')
		const ru = await createLanguageRow(project.id, 'ru', true)
		await createLanguageRow(project.id, 'de-AT')
		await createLanguageRow(other.id, 'hu', true)

		const res = await request(app).get(languagesUrl(project.id)).set('Cookie', cookie)

		expect(res.status).toBe(200)
		const languages = languagesResponseSchema.parse(res.body)
		expect(languages.map(({ tag }) => tag)).toEqual(['ru', 'de-AT', 'sk'])
		expect(languageSchema.strict().parse(languages[0])).toEqual({
			id: ru.id,
			tag: 'ru',
			englishName: 'Russian',
			nativeName: 'русский',
			flagCode: 'ru',
			isBase: true,
			createdAt: ru.createdAt.toISOString(),
		})
	})

	it('returns 404 NOT_FOUND to an EDITOR who is not a member and 200 to an ADMIN who is not', async () => {
		const app = createTestApp()
		const editor = await loginToProject(app, ROLE.EDITOR, { member: false })
		const admin = await loginToProject(app, ROLE.ADMIN, { member: false })

		expectErrorCode(await request(app).get(languagesUrl(editor.project.id)).set('Cookie', editor.cookie), 404, ERROR_CODE.NOT_FOUND)
		expect((await request(app).get(languagesUrl(admin.project.id)).set('Cookie', admin.cookie)).status).toBe(200)
	})

	it('returns 401 AUTH_UNAUTHENTICATED without a session', async () => {
		const project = await getTestPrisma().project.create({ data: { name: 'A', slug: 'a' } })

		expectErrorCode(await request(createTestApp()).get(languagesUrl(project.id)), 401, ERROR_CODE.AUTH_UNAUTHENTICATED)
	})

	it('the old global endpoints are gone', async () => {
		const app = createTestApp()
		const { cookie } = await loginToProject(app, ROLE.ADMIN)

		expectErrorCode(await request(app).get('/api/languages').set('Cookie', cookie), 404, ERROR_CODE.NOT_FOUND)
		expectErrorCode(await request(app).get('/api/admin/languages').set('Cookie', cookie), 404, ERROR_CODE.NOT_FOUND)
	})
})

describe('POST /api/projects/:projectId/languages', () => {
	it('makes the first language of the project the base, a further one not', async () => {
		const app = createTestApp()
		const { project, cookie } = await loginToProject(app)
		const other = await getTestPrisma().project.create({ data: { name: 'B', slug: 'b' } })
		await createLanguageRow(other.id, 'sk', true)

		const first = await postLanguage(app, cookie, project.id, { tag: 'sk', isBase: false, englishName: 'Ignored' })
		const second = await postLanguage(app, cookie, project.id, { tag: 'en' })

		expect(first.status).toBe(201)
		expect(languageSchema.strict().parse(first.body)).toMatchObject({ tag: 'sk', englishName: 'Slovak', flagCode: 'sk', isBase: true })
		expect(second.status).toBe(201)
		expect(languageSchema.parse(second.body)).toMatchObject({ tag: 'en', isBase: false })
	})

	it('returns 400 for a tag outside the catalog and 409 LANGUAGE_TAKEN for a tag already in the project', async () => {
		const app = createTestApp()
		const { project, cookie } = await loginToProject(app)
		await createLanguageRow(project.id, 'sk', true)

		const invalid = await postLanguage(app, cookie, project.id, { tag: 'fr' })
		expectErrorCode(invalid, 400, ERROR_CODE.VALIDATION_ERROR)
		expect(errorResponseSchema.parse(invalid.body).error.details).toEqual([{ path: 'tag', code: VALIDATION_CODE.INVALID }])
		expectErrorCode(await postLanguage(app, cookie, project.id, { tag: 'sk' }), 409, ERROR_CODE.LANGUAGE_TAKEN)
		expect(await getTestPrisma().projectLanguage.count()).toBe(1)
	})

	it('makes exactly one of two concurrent first languages the base', async () => {
		const app = createTestApp()
		const { project, cookie } = await loginToProject(app)

		const responses = await Promise.all([postLanguage(app, cookie, project.id, { tag: 'sk' }), postLanguage(app, cookie, project.id, { tag: 'en' })])

		expect(responses.map(({ status }) => status)).toEqual([201, 201])
		expect(await getTestPrisma().projectLanguage.count({ where: { projectId: project.id, isBase: true } })).toBe(1)
	})

	it('returns 404 NOT_FOUND to an EDITOR who is not a member and 403 CSRF_REJECTED without the header', async () => {
		const app = createTestApp()
		const outsider = await loginToProject(app, ROLE.EDITOR, { member: false })
		const member = await loginToProject(app)

		expectErrorCode(await postLanguage(app, outsider.cookie, outsider.project.id, { tag: 'sk' }), 404, ERROR_CODE.NOT_FOUND)
		expectErrorCode(
			await request(app).post(languagesUrl(member.project.id)).set('Cookie', member.cookie).send({ tag: 'sk' }),
			403,
			ERROR_CODE.CSRF_REJECTED,
		)
		expect(await getTestPrisma().projectLanguage.count()).toBe(0)
	})
})

describe('DELETE /api/projects/:projectId/languages/:languageId', () => {
	it('removes a language that is not the base', async () => {
		const app = createTestApp()
		const { project, cookie } = await loginToProject(app)
		await createLanguageRow(project.id, 'sk', true)
		const en = await createLanguageRow(project.id, 'en')

		const res = await deleteLanguage(app, cookie, project.id, en.id)

		expect(res.status).toBe(204)
		expect((await getTestPrisma().projectLanguage.findMany({ where: { projectId: project.id } })).map(({ tag }) => tag)).toEqual(['sk'])
	})

	it('returns 409 LANGUAGE_IS_BASE for the base language', async () => {
		const app = createTestApp()
		const { project, cookie } = await loginToProject(app)
		const sk = await createLanguageRow(project.id, 'sk', true)

		expectErrorCode(await deleteLanguage(app, cookie, project.id, sk.id), 409, ERROR_CODE.LANGUAGE_IS_BASE)
		expect(await getTestPrisma().projectLanguage.count()).toBe(1)
	})

	it.each([
		{
			name: 'a language of another project',
			id: async () => (await createLanguageRow((await getTestPrisma().project.create({ data: { name: 'B', slug: 'b' } })).id, 'en')).id,
		},
		{ name: 'an unknown id', id: () => Promise.resolve(randomUUID()) },
		{ name: 'an id that is not a UUID', id: () => Promise.resolve('not-a-uuid') },
	])('returns 404 NOT_FOUND for $name', async ({ id }) => {
		const app = createTestApp()
		const { project, cookie } = await loginToProject(app)
		const languageId = await id()
		const before = await getTestPrisma().projectLanguage.count()

		expectErrorCode(await deleteLanguage(app, cookie, project.id, languageId), 404, ERROR_CODE.NOT_FOUND)
		expect(await getTestPrisma().projectLanguage.count()).toBe(before)
	})
})

describe('ProjectLanguage table', () => {
	it('rejects a second base language in one project (partial unique index) but allows one per project', async () => {
		const prisma = getTestPrisma()
		const first = await prisma.project.create({ data: { name: 'A', slug: 'a' } })
		const second = await prisma.project.create({ data: { name: 'B', slug: 'b' } })
		await createLanguageRow(first.id, 'sk', true)
		await createLanguageRow(second.id, 'sk', true)

		await expect(createLanguageRow(first.id, 'en', true)).rejects.toThrow()
	})
})
