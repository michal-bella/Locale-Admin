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

const createLanguageRow = (projectId: string, tag: LanguageTag, isBase = false, position = 0) =>
	getTestPrisma().projectLanguage.create({ data: { projectId, tag, isBase, position } })

const languagesUrl = (projectId: string) => `/api/projects/${projectId}/languages`

const postLanguage = (app: App, cookie: string, projectId: string, body: unknown) =>
	request(app)
		.post(languagesUrl(projectId))
		.set('Cookie', cookie)
		.set(CSRF_HEADERS)
		.send(body as object)

const putOrder = (app: App, cookie: string, projectId: string, body: unknown) =>
	request(app)
		.put(`${languagesUrl(projectId)}/order`)
		.set('Cookie', cookie)
		.set(CSRF_HEADERS)
		.send(body as object)

const tagsInOrder = async (projectId: string) =>
	(await getTestPrisma().projectLanguage.findMany({ where: { projectId }, orderBy: { position: 'asc' } })).map(({ tag, isBase }) =>
		isBase ? `${tag}*` : tag,
	)

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

	it('orders the languages after the base by position, then by tag', async () => {
		const app = createTestApp()
		const { project, cookie } = await loginToProject(app)
		await createLanguageRow(project.id, 'en', false, 0)
		await createLanguageRow(project.id, 'sk', true, 2)
		await createLanguageRow(project.id, 'ru', false, 1)
		await createLanguageRow(project.id, 'bg', false, 1)

		const res = await request(app).get(languagesUrl(project.id)).set('Cookie', cookie)

		expect(languagesResponseSchema.parse(res.body).map(({ tag }) => tag)).toEqual(['sk', 'en', 'bg', 'ru'])
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

	it('puts a new language last', async () => {
		const app = createTestApp()
		const { project, cookie } = await loginToProject(app)
		await createLanguageRow(project.id, 'sk', true, 0)
		await createLanguageRow(project.id, 'ru', false, 4)

		expect((await postLanguage(app, cookie, project.id, { tag: 'bg' })).status).toBe(201)
		expect(await tagsInOrder(project.id)).toEqual(['sk*', 'ru', 'bg'])
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

describe('PUT /api/projects/:projectId/languages/order', () => {
	it('saves the order, makes the first language the base and returns the list in the new order', async () => {
		const app = createTestApp()
		const { project, cookie } = await loginToProject(app)
		const sk = await createLanguageRow(project.id, 'sk', true, 0)
		const en = await createLanguageRow(project.id, 'en', false, 1)
		const ru = await createLanguageRow(project.id, 'ru', false, 2)

		const res = await putOrder(app, cookie, project.id, { languageIds: [en.id, ru.id, sk.id] })

		expect(res.status).toBe(200)
		expect(languagesResponseSchema.parse(res.body).map(({ tag, isBase }) => ({ tag, isBase }))).toEqual([
			{ tag: 'en', isBase: true },
			{ tag: 'ru', isBase: false },
			{ tag: 'sk', isBase: false },
		])
		expect(await tagsInOrder(project.id)).toEqual(['en*', 'ru', 'sk'])
		const settings = await request(app).get(`/api/projects/${project.id}/settings`).set('Cookie', cookie)
		expect(settings.body).toMatchObject({ baseLanguageId: en.id })
	})

	it('keeps the base when the first language stays', async () => {
		const app = createTestApp()
		const { project, cookie } = await loginToProject(app)
		const sk = await createLanguageRow(project.id, 'sk', true, 0)
		const en = await createLanguageRow(project.id, 'en', false, 1)
		const ru = await createLanguageRow(project.id, 'ru', false, 2)

		expect((await putOrder(app, cookie, project.id, { languageIds: [sk.id, ru.id, en.id] })).status).toBe(200)
		expect(await tagsInOrder(project.id)).toEqual(['sk*', 'ru', 'en'])
	})

	it.each([
		{ name: 'a missing language', ids: (sk: string, _en: string) => [sk] },
		{ name: 'a language of another project', ids: (sk: string, en: string, foreign: string) => [sk, en, foreign] },
		{ name: 'an unknown id', ids: (sk: string, en: string) => [sk, en, randomUUID()] },
	])('returns 400 VALIDATION_ERROR and writes nothing for $name', async ({ ids }) => {
		const app = createTestApp()
		const { project, cookie } = await loginToProject(app)
		const sk = await createLanguageRow(project.id, 'sk', true, 0)
		const en = await createLanguageRow(project.id, 'en', false, 1)
		const foreign = await createLanguageRow((await getTestPrisma().project.create({ data: { name: 'B', slug: 'b' } })).id, 'ru', true)

		const res = await putOrder(app, cookie, project.id, { languageIds: ids(sk.id, en.id, foreign.id) })

		expectErrorCode(res, 400, ERROR_CODE.VALIDATION_ERROR)
		expect(errorResponseSchema.parse(res.body).error.details).toEqual([{ path: 'languageIds', code: VALIDATION_CODE.INVALID }])
		expect(await tagsInOrder(project.id)).toEqual(['sk*', 'en'])
	})

	it('returns 400 VALIDATION_ERROR for duplicate ids and an empty list', async () => {
		const app = createTestApp()
		const { project, cookie } = await loginToProject(app)
		const sk = await createLanguageRow(project.id, 'sk', true, 0)

		expectErrorCode(await putOrder(app, cookie, project.id, { languageIds: [sk.id, sk.id] }), 400, ERROR_CODE.VALIDATION_ERROR)
		expectErrorCode(await putOrder(app, cookie, project.id, { languageIds: [] }), 400, ERROR_CODE.VALIDATION_ERROR)
	})

	it('returns 404 NOT_FOUND to an EDITOR who is not a member and 403 CSRF_REJECTED without the header', async () => {
		const app = createTestApp()
		const outsider = await loginToProject(app, ROLE.EDITOR, { member: false })
		const member = await loginToProject(app)
		const sk = await createLanguageRow(member.project.id, 'sk', true)

		expectErrorCode(await putOrder(app, outsider.cookie, outsider.project.id, { languageIds: [sk.id] }), 404, ERROR_CODE.NOT_FOUND)
		expectErrorCode(
			await request(app)
				.put(`${languagesUrl(member.project.id)}/order`)
				.set('Cookie', member.cookie)
				.send({ languageIds: [sk.id] }),
			403,
			ERROR_CODE.CSRF_REJECTED,
		)
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
