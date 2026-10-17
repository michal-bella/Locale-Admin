import { randomUUID } from 'node:crypto'

import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { ERROR_CODE, ROLE, VALIDATION_CODE, errorResponseSchema, languageSchema, languagesResponseSchema, type LanguageTag } from '@locale/shared'

import { getSupportedLanguage } from '../src/services/adminLanguages.service'

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
	return loginAs(app, { email: user.email, password: TEST_PASSWORD })
}

const createLanguageRow = (tag: LanguageTag, { isBase = false, createdAt }: { isBase?: boolean; createdAt?: Date } = {}) => {
	const { englishName, nativeName, flagCode } = getSupportedLanguage(tag)
	return getTestPrisma().language.create({ data: { tag, englishName, nativeName, flagCode, isBase, createdAt } })
}

const postLanguage = (app: App, cookie: string, body: unknown) =>
	request(app)
		.post('/api/admin/languages')
		.set('Cookie', cookie)
		.set(CSRF_HEADERS)
		.send(body as object)

const patchLanguage = (app: App, cookie: string, id: string, body: unknown) =>
	request(app)
		.patch(`/api/admin/languages/${id}`)
		.set('Cookie', cookie)
		.set(CSRF_HEADERS)
		.send(body as object)

/** The FE sends an empty JSON body with every mutation, the CSRF check needs `Content-Type: application/json`. */
const deleteLanguage = (app: App, cookie: string, id: string) =>
	request(app).delete(`/api/admin/languages/${id}`).set('Cookie', cookie).set(CSRF_HEADERS).send({})

const UPDATE_BODY = { englishName: 'Russian', nativeName: 'русский', flagCode: 'ru' }

describe('GET /api/admin/languages', () => {
	it('returns the base language first, then by tag', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)
		const ru = await createLanguageRow('ru')
		const sk = await createLanguageRow('sk', { isBase: true, createdAt: new Date('2026-01-01T00:00:00Z') })
		const en = await createLanguageRow('en')
		const deAt = await createLanguageRow('de-AT')

		const res = await request(app).get('/api/admin/languages').set('Cookie', cookie)

		expect(res.status).toBe(200)
		const languages = languageSchema.strict().array().parse(res.body)
		expect(languages.map(({ id }) => id)).toEqual([sk.id, deAt.id, en.id, ru.id])
		expect(languages[0]).toEqual({
			id: sk.id,
			tag: 'sk',
			englishName: 'Slovak',
			nativeName: 'slovenčina',
			flagCode: 'sk',
			isBase: true,
			createdAt: '2026-01-01T00:00:00.000Z',
		})
	})

	it('returns an empty array without languages', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)

		const res = await request(app).get('/api/admin/languages').set('Cookie', cookie)

		expect(res.status).toBe(200)
		expect(res.body).toEqual([])
	})

	it('returns 401 AUTH_UNAUTHENTICATED without a session', async () => {
		const res = await request(createTestApp()).get('/api/admin/languages')

		expectErrorCode(res, 401, ERROR_CODE.AUTH_UNAUTHENTICATED)
	})

	it('returns 403 FORBIDDEN for an EDITOR', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.EDITOR)

		const res = await request(app).get('/api/admin/languages').set('Cookie', cookie)

		expectErrorCode(res, 403, ERROR_CODE.FORBIDDEN)
	})
})

describe('POST /api/admin/languages', () => {
	it('makes the first language the base and fills names and flag from the catalog', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)

		const res = await postLanguage(app, cookie, { tag: 'de-AT', englishName: 'Ignored', isBase: false })

		expect(res.status).toBe(201)
		const body = languageSchema.strict().parse(res.body)
		expect(body).toMatchObject({ tag: 'de-AT', englishName: 'German (Austria)', nativeName: 'Deutsch (Österreich)', flagCode: 'at', isBase: true })
		const stored = await getTestPrisma().language.findUniqueOrThrow({ where: { id: body.id } })
		expect(body.createdAt).toBe(stored.createdAt.toISOString())
	})

	it('adds a further language as not base', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)
		await createLanguageRow('sk', { isBase: true })

		const res = await postLanguage(app, cookie, { tag: 'cs' })

		expect(res.status).toBe(201)
		expect(languageSchema.parse(res.body)).toMatchObject({ tag: 'cs', englishName: 'Czech', nativeName: 'čeština', flagCode: 'cz', isBase: false })
		expect(await getTestPrisma().language.count({ where: { isBase: true } })).toBe(1)
	})

	it.each([
		{ name: 'a tag outside the catalog', body: { tag: 'fr' } },
		{ name: 'a missing tag', body: {} },
	])('returns 400 VALIDATION_ERROR with details for $name', async ({ body }) => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)

		const res = await postLanguage(app, cookie, body)

		expectErrorCode(res, 400, ERROR_CODE.VALIDATION_ERROR)
		expect(errorResponseSchema.parse(res.body).error.details).toEqual([{ path: 'tag', code: VALIDATION_CODE.INVALID }])
		expect(await getTestPrisma().language.count()).toBe(0)
	})

	it('returns 409 LANGUAGE_TAKEN for an existing tag', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)
		await createLanguageRow('sk', { isBase: true })

		const res = await postLanguage(app, cookie, { tag: 'sk' })

		expectErrorCode(res, 409, ERROR_CODE.LANGUAGE_TAKEN)
		expect(await getTestPrisma().language.count()).toBe(1)
	})

	it('returns 409 LANGUAGE_TAKEN for one of two concurrent requests with the same tag', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)
		await createLanguageRow('sk', { isBase: true })

		const responses = await Promise.all([postLanguage(app, cookie, { tag: 'ru' }), postLanguage(app, cookie, { tag: 'ru' })])

		expect(responses.map(({ status }) => status).sort()).toEqual([201, 409])
		expectErrorCode(responses.find(({ status }) => status === 409) as request.Response, 409, ERROR_CODE.LANGUAGE_TAKEN)
	})

	it('returns 401 AUTH_UNAUTHENTICATED without a session', async () => {
		const res = await request(createTestApp()).post('/api/admin/languages').set(CSRF_HEADERS).send({ tag: 'sk' })

		expectErrorCode(res, 401, ERROR_CODE.AUTH_UNAUTHENTICATED)
		expect(await getTestPrisma().language.count()).toBe(0)
	})

	it('returns 403 FORBIDDEN for an EDITOR', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.EDITOR)

		const res = await postLanguage(app, cookie, { tag: 'sk' })

		expectErrorCode(res, 403, ERROR_CODE.FORBIDDEN)
		expect(await getTestPrisma().language.count()).toBe(0)
	})

	it('returns 403 CSRF_REJECTED without X-Requested-With', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)

		const res = await request(app).post('/api/admin/languages').set('Cookie', cookie).send({ tag: 'sk' })

		expectErrorCode(res, 403, ERROR_CODE.CSRF_REJECTED)
		expect(await getTestPrisma().language.count()).toBe(0)
	})
})

describe('PATCH /api/admin/languages/:id', () => {
	it('saves trimmed names and the flag and ignores the tag', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)
		await createLanguageRow('sk', { isBase: true })
		const en = await createLanguageRow('en')

		const res = await patchLanguage(app, cookie, en.id, { englishName: '  English (UK) ', nativeName: ' English ', flagCode: 'gb', tag: 'ru' })

		expect(res.status).toBe(200)
		const expected = {
			id: en.id,
			tag: 'en',
			englishName: 'English (UK)',
			nativeName: 'English',
			flagCode: 'gb',
			isBase: false,
			createdAt: en.createdAt.toISOString(),
		}
		expect(languageSchema.strict().parse(res.body)).toEqual(expected)
		expect(await getTestPrisma().language.findUniqueOrThrow({ where: { id: en.id } })).toMatchObject({
			tag: 'en',
			englishName: 'English (UK)',
			nativeName: 'English',
			flagCode: 'gb',
			isBase: false,
		})
	})

	it('changes the flag', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)
		const en = await createLanguageRow('en', { isBase: true })

		const res = await patchLanguage(app, cookie, en.id, { englishName: 'English', nativeName: 'English', flagCode: 'sk' })

		expect(res.status).toBe(200)
		expect(languageSchema.parse(res.body).flagCode).toBe('sk')
		expect((await getTestPrisma().language.findUniqueOrThrow({ where: { id: en.id } })).flagCode).toBe('sk')
	})

	it('moves the base flag with isBase: true', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)
		const sk = await createLanguageRow('sk', { isBase: true })
		const ru = await createLanguageRow('ru')

		const res = await patchLanguage(app, cookie, ru.id, { ...UPDATE_BODY, isBase: true })

		expect(res.status).toBe(200)
		expect(languageSchema.parse(res.body).isBase).toBe(true)
		const bases = await getTestPrisma().language.findMany({ where: { isBase: true } })
		expect(bases.map(({ id }) => id)).toEqual([ru.id])
		expect((await getTestPrisma().language.findUniqueOrThrow({ where: { id: sk.id } })).isBase).toBe(false)

		const list = languagesResponseSchema.parse((await request(app).get('/api/admin/languages').set('Cookie', cookie)).body)
		expect(list.map(({ tag }) => tag)).toEqual(['ru', 'sk'])
	})

	it('keeps the base when the base language is saved with isBase: true', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)
		const ru = await createLanguageRow('ru', { isBase: true })

		const res = await patchLanguage(app, cookie, ru.id, { ...UPDATE_BODY, isBase: true })

		expect(res.status).toBe(200)
		expect(await getTestPrisma().language.count({ where: { isBase: true } })).toBe(1)
	})

	it('does not unset the base when the body has no isBase', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)
		const ru = await createLanguageRow('ru', { isBase: true })

		const res = await patchLanguage(app, cookie, ru.id, UPDATE_BODY)

		expect(res.status).toBe(200)
		expect(languageSchema.parse(res.body).isBase).toBe(true)
	})

	it.each([
		{
			name: 'empty names and an unknown flag',
			body: { englishName: '   ', nativeName: '', flagCode: 'fr' },
			details: [
				{ path: 'englishName', code: VALIDATION_CODE.REQUIRED },
				{ path: 'nativeName', code: VALIDATION_CODE.REQUIRED },
				{ path: 'flagCode', code: VALIDATION_CODE.INVALID },
			],
		},
		{
			name: 'a too long name and isBase: false',
			body: { ...UPDATE_BODY, englishName: 'a'.repeat(101), isBase: false },
			details: [
				{ path: 'englishName', code: VALIDATION_CODE.TOO_LONG, params: { max: 100 } },
				{ path: 'isBase', code: VALIDATION_CODE.INVALID },
			],
		},
	])('returns 400 VALIDATION_ERROR with details for $name', async ({ body, details }) => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)
		const ru = await createLanguageRow('ru', { isBase: true })

		const res = await patchLanguage(app, cookie, ru.id, body)

		expectErrorCode(res, 400, ERROR_CODE.VALIDATION_ERROR)
		expect(errorResponseSchema.parse(res.body).error.details).toEqual(details)
		expect(await getTestPrisma().language.findUniqueOrThrow({ where: { id: ru.id } })).toEqual(ru)
	})

	it.each([
		{ name: 'an unknown id', id: randomUUID() },
		{ name: 'a non-UUID id', id: 'not-a-uuid' },
	])('returns 404 NOT_FOUND for $name', async ({ id }) => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)
		const sk = await createLanguageRow('sk', { isBase: true })

		const res = await patchLanguage(app, cookie, id, { ...UPDATE_BODY, isBase: true })

		expectErrorCode(res, 404, ERROR_CODE.NOT_FOUND)
		expect((await getTestPrisma().language.findUniqueOrThrow({ where: { id: sk.id } })).isBase).toBe(true)
	})

	it('returns 401 AUTH_UNAUTHENTICATED without a session', async () => {
		const ru = await createLanguageRow('ru', { isBase: true })

		const res = await request(createTestApp()).patch(`/api/admin/languages/${ru.id}`).set(CSRF_HEADERS).send(UPDATE_BODY)

		expectErrorCode(res, 401, ERROR_CODE.AUTH_UNAUTHENTICATED)
	})

	it('returns 403 FORBIDDEN for an EDITOR', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.EDITOR)
		const ru = await createLanguageRow('ru', { isBase: true })

		const res = await patchLanguage(app, cookie, ru.id, { ...UPDATE_BODY, englishName: 'Changed' })

		expectErrorCode(res, 403, ERROR_CODE.FORBIDDEN)
		expect(await getTestPrisma().language.findUniqueOrThrow({ where: { id: ru.id } })).toEqual(ru)
	})

	it('returns 403 CSRF_REJECTED without X-Requested-With', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)
		const ru = await createLanguageRow('ru', { isBase: true })

		const res = await request(app)
			.patch(`/api/admin/languages/${ru.id}`)
			.set('Cookie', cookie)
			.send({ ...UPDATE_BODY, englishName: 'Changed' })

		expectErrorCode(res, 403, ERROR_CODE.CSRF_REJECTED)
		expect(await getTestPrisma().language.findUniqueOrThrow({ where: { id: ru.id } })).toEqual(ru)
	})
})

describe('DELETE /api/admin/languages/:id', () => {
	it('deletes a language that is not the base', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)
		await createLanguageRow('sk', { isBase: true })
		const ru = await createLanguageRow('ru')

		const res = await deleteLanguage(app, cookie, ru.id)

		expect(res.status).toBe(204)
		expect(res.text).toBe('')
		expect(await getTestPrisma().language.findUnique({ where: { id: ru.id } })).toBeNull()
		expect(await getTestPrisma().language.count()).toBe(1)
	})

	it('returns 409 LANGUAGE_IS_BASE for the base language', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)
		const sk = await createLanguageRow('sk', { isBase: true })

		const res = await deleteLanguage(app, cookie, sk.id)

		expectErrorCode(res, 409, ERROR_CODE.LANGUAGE_IS_BASE)
		expect(await getTestPrisma().language.count()).toBe(1)
	})

	it.each([
		{ name: 'an unknown id', id: randomUUID() },
		{ name: 'a non-UUID id', id: 'not-a-uuid' },
	])('returns 404 NOT_FOUND for $name', async ({ id }) => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)
		await createLanguageRow('sk', { isBase: true })

		const res = await deleteLanguage(app, cookie, id)

		expectErrorCode(res, 404, ERROR_CODE.NOT_FOUND)
		expect(await getTestPrisma().language.count()).toBe(1)
	})

	it('returns 401 AUTH_UNAUTHENTICATED without a session', async () => {
		await createLanguageRow('sk', { isBase: true })
		const ru = await createLanguageRow('ru')

		const res = await request(createTestApp()).delete(`/api/admin/languages/${ru.id}`).set(CSRF_HEADERS).send({})

		expectErrorCode(res, 401, ERROR_CODE.AUTH_UNAUTHENTICATED)
		expect(await getTestPrisma().language.count()).toBe(2)
	})

	it('returns 403 FORBIDDEN for an EDITOR', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.EDITOR)
		await createLanguageRow('sk', { isBase: true })
		const ru = await createLanguageRow('ru')

		const res = await deleteLanguage(app, cookie, ru.id)

		expectErrorCode(res, 403, ERROR_CODE.FORBIDDEN)
		expect(await getTestPrisma().language.count()).toBe(2)
	})

	it('returns 403 CSRF_REJECTED without X-Requested-With', async () => {
		const app = createTestApp()
		const cookie = await loginWithRole(app, ROLE.ADMIN)
		await createLanguageRow('sk', { isBase: true })
		const ru = await createLanguageRow('ru')

		const res = await request(app).delete(`/api/admin/languages/${ru.id}`).set('Cookie', cookie).send({})

		expectErrorCode(res, 403, ERROR_CODE.CSRF_REJECTED)
		expect(await getTestPrisma().language.count()).toBe(2)
	})
})

describe('Language table', () => {
	it('rejects a second base language (partial unique index)', async () => {
		await createLanguageRow('sk', { isBase: true })

		await expect(createLanguageRow('en', { isBase: true })).rejects.toMatchObject({ code: 'P2002' })
		await expect(createLanguageRow('en')).resolves.toMatchObject({ isBase: false })
	})
})
