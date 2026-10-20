import { randomUUID } from 'node:crypto'

import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { ERROR_CODE, EXPORT_ISSUES_MAX, ROLE, errorResponseSchema, exportValueUnsafeDetailsSchema, importResultSchema } from '@locale/shared'

import { EXPORT_BATCH_SIZE } from '../src/services/exports.service'

import { createTestApp } from './helpers/app'
import { CSRF_HEADERS, loginAs } from './helpers/auth'
import { getTestPrisma } from './helpers/db'
import { TEST_PASSWORD, createUser } from './helpers/users'

type App = ReturnType<typeof createTestApp>

const expectErrorCode = (res: request.Response, status: number, code: ERROR_CODE) => {
	expect(res.status).toBe(status)
	expect(errorResponseSchema.parse(res.body).error.code).toBe(code)
}

const createProject = (members: string[] = []) =>
	getTestPrisma().project.create({
		data: { name: 'A', slug: `a-${randomUUID().slice(0, 8)}`, members: { create: members.map((userId) => ({ userId })) } },
	})

const createLanguage = (projectId: string, tag: string, { isBase = false, position = 0 } = {}) =>
	getTestPrisma().projectLanguage.create({ data: { projectId, tag, isBase, position } })

/** `values` maps a language id to its value; a language left out has no row. */
const createKey = (projectId: string, namespace: string, name: string, values: Record<string, string | null> = {}) =>
	getTestPrisma().translationKey.create({
		data: { projectId, namespace, name, translations: { create: Object.entries(values).map(([languageId, value]) => ({ languageId, value })) } },
	})

/** A member of a new project with `sk` (base), then `en` and `cs` in the order of their position. */
const setup = async (app: App, { member = true }: { member?: boolean } = {}) => {
	const { user } = await createUser({ role: ROLE.EDITOR })
	const project = await createProject(member ? [user.id] : [])
	const cs = await createLanguage(project.id, 'cs', { position: 2 })
	const sk = await createLanguage(project.id, 'sk', { isBase: true, position: 1 })
	const en = await createLanguage(project.id, 'en', { position: 0 })
	return { project, sk, en, cs, cookie: await loginAs(app, { email: user.email, password: TEST_PASSWORD }) }
}

const exportCsv = (app: App, cookie: string, projectId: string, query: Record<string, string>) =>
	request(app).get(`/api/projects/${projectId}/export`).query(query).set('Cookie', cookie)

const exportOk = async (...args: Parameters<typeof exportCsv>) => {
	const res = await exportCsv(...args)
	expect(res.status).toBe(200)
	return res.text
}

describe('GET /api/projects/:projectId/export', () => {
	it('streams the CSV with the base language first, keys without namespace first and both sorted by bytes', async () => {
		const app = createTestApp()
		const { project, sk, en, cs, cookie } = await setup(app)
		const other = await createProject()
		await createKey(other.id, 'loc', 'Cudzí', { [(await createLanguage(other.id, 'sk', { isBase: true })).id]: 'Cudzí' })
		await createKey(project.id, 'paths', 'orders', { [en.id]: '/orders' })
		await createKey(project.id, 'loc', 'Zrušiť', { [sk.id]: 'Zrušiť', [en.id]: null })
		await createKey(project.id, 'loc', 'Áno', { [sk.id]: 'Áno', [en.id]: 'Yes', [cs.id]: 'Ano' })
		await createKey(project.id, 'loc', 'items', { [sk.id]: '{count, plural, one {# kus} other {# kusov}}' })
		await createKey(project.id, '', 'title', { [sk.id]: 'Titulok' })

		const res = await exportCsv(app, cookie, project.id, { languageIds: [cs.id, en.id, sk.id].join(',') })

		expect(res.status).toBe(200)
		expect(res.headers['content-type']).toBe('text/csv; charset=utf-8')
		expect(res.headers['content-disposition']).toBe('attachment; filename="translations.csv"')
		expect(res.text).toBe(
			[
				'Keys; sk ; en ; cs ',
				' title; Titulok; null; null',
				'--loc--',
				' Zrušiť; Zrušiť; null; null',
				' items; {count, plural, one {# kus} other {# kusov}}; null; null',
				' Áno; Áno; Yes; Ano',
				'--paths--',
				' orders; null; /orders; null',
				'',
			].join('\n'),
		)
	})

	it('exports only the selected languages', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app)
		await createKey(project.id, 'loc', 'Áno', { [sk.id]: 'Áno', [en.id]: 'Yes' })

		expect(await exportOk(app, cookie, project.id, { languageIds: en.id })).toBe('Keys; en \n--loc--\n Áno; Yes\n')
	})

	it('filters keys by status over the selected languages', async () => {
		const app = createTestApp()
		const { project, sk, en, cs, cookie } = await setup(app)
		await createKey(project.id, 'loc', 'all', { [sk.id]: 'a', [en.id]: 'a', [cs.id]: 'a' })
		await createKey(project.id, 'loc', 'noCs', { [sk.id]: 'b', [en.id]: 'b', [cs.id]: null })
		await createKey(project.id, 'loc', 'onlySk', { [sk.id]: 'c' })
		const skEn = [sk.id, en.id].join(',')

		expect(await exportOk(app, cookie, project.id, { languageIds: skEn, status: 'TRANSLATED' })).toBe('Keys; sk ; en \n--loc--\n all; a; a\n noCs; b; b\n')
		expect(await exportOk(app, cookie, project.id, { languageIds: skEn, status: 'UNTRANSLATED' })).toBe('Keys; sk ; en \n--loc--\n onlySk; c; null\n')
		const allLanguages = [sk.id, en.id, cs.id].join(',')
		expect(await exportOk(app, cookie, project.id, { languageIds: allLanguages, status: 'UNTRANSLATED' })).toBe(
			'Keys; sk ; en ; cs \n--loc--\n noCs; b; b; null\n onlySk; c; null; null\n',
		)
	})

	it('writes every key once in order across batches', async () => {
		const app = createTestApp()
		const { project, sk, cookie } = await setup(app)
		const count = EXPORT_BATCH_SIZE + 5
		const names = Array.from({ length: count }, (_, index) => `key.${String(index).padStart(5, '0')}`)
		await getTestPrisma().translationKey.createMany({
			data: names.map((name, index) => ({ projectId: project.id, namespace: index % 2 === 0 ? 'a' : 'b', name })),
		})

		const lines = (await exportOk(app, cookie, project.id, { languageIds: sk.id })).trimEnd().split('\n')

		const expected = (namespace: string, parity: number) => names.filter((_, index) => index % 2 === parity).map((name) => ` ${name}; null`)
		expect(lines).toEqual(['Keys; sk ', '--a--', ...expected('a', 0), '--b--', ...expected('b', 1)])
	})

	it('gives back the imported file byte for byte', async () => {
		const app = createTestApp()
		const { project, sk, en, cs, cookie } = await setup(app)
		const file = [
			'Keys; sk ; en ; cs ',
			'--loc--',
			' (vlastná); (vlastné); (custom); (vlastní)',
			' +{{count}} ďalšie; +{{count}} ďalšie; +{{count}} more; null',
			' Klient bude označený <strong>blacklist</strong>.; Klient bude označený <strong>blacklist</strong>.; null; null',
			'--paths--',
			' about-application; /o-aplikacii; /about-application; /o-aplikaci',
			'',
		].join('\n')
		const columns = [sk, en, cs].map((language, index) => ({ columnIndex: index + 2, languageId: language.id }))
		const imported = await request(app)
			.post(`/api/projects/${project.id}/imports`)
			.set('Cookie', cookie)
			.set(CSRF_HEADERS)
			.send({ fileName: 'translations.csv', content: file, columns })
		expect(importResultSchema.parse(imported.body).keysCreated).toBe(4)

		expect(await exportOk(app, cookie, project.id, { languageIds: [sk.id, en.id, cs.id].join(',') })).toBe(file)
	})

	it('refuses values that would break the file with 422 and the first issues, before sending anything', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app)
		const semicolon = await createKey(project.id, 'loc', 'nbsp', { [sk.id]: 'Ahoj&nbsp;svet' })
		const marker = await createKey(project.id, 'loc', 'range', { [sk.id]: 'Od --9-- do' })
		await createKey(project.id, 'loc', 'ok', { [sk.id]: 'ok' })
		await createKey(project.id, 'other', 'lines', { [en.id]: 'a\nb' })

		const res = await exportCsv(app, cookie, project.id, { languageIds: sk.id })

		expectErrorCode(res, 422, ERROR_CODE.EXPORT_VALUE_UNSAFE)
		expect(res.headers['content-type']).toMatch(/^application\/json/)
		expect(errorResponseSchema.parse(res.body).error.details).toEqual({
			issues: [
				{ code: 'SEMICOLON', keyId: semicolon.id, namespace: 'loc', key: 'nbsp', languageTag: 'sk' },
				{ code: 'SECTION_MARKER', keyId: marker.id, namespace: 'loc', key: 'range', languageTag: null },
			],
			total: 2,
		})
	})

	it(`lists at most ${EXPORT_ISSUES_MAX} issues with the full count`, async () => {
		const app = createTestApp()
		const { project, sk, cookie } = await setup(app)
		const key = await createKey(project.id, 'loc', 'a;b', { [sk.id]: 'x;y' })
		await getTestPrisma().translationKey.createMany({
			data: Array.from({ length: EXPORT_ISSUES_MAX }, (_, index) => ({ projectId: project.id, namespace: 'loc', name: `k;${index}` })),
		})

		const res = await exportCsv(app, cookie, project.id, { languageIds: sk.id })

		expectErrorCode(res, 422, ERROR_CODE.EXPORT_VALUE_UNSAFE)
		const details = exportValueUnsafeDetailsSchema.parse(errorResponseSchema.parse(res.body).error.details)
		expect(details.total).toBe(EXPORT_ISSUES_MAX + 2)
		expect(details.issues).toHaveLength(EXPORT_ISSUES_MAX)
		expect(details.issues.slice(0, 2)).toEqual([
			{ code: 'SEMICOLON', keyId: key.id, namespace: 'loc', key: 'a;b', languageTag: null },
			{ code: 'SEMICOLON', keyId: key.id, namespace: 'loc', key: 'a;b', languageTag: 'sk' },
		])
	})

	it('returns 400 for a language of another project and an invalid query', async () => {
		const app = createTestApp()
		const { project, sk, cookie } = await setup(app)
		const foreign = await createLanguage((await createProject()).id, 'sk', { isBase: true })

		expectErrorCode(await exportCsv(app, cookie, project.id, { languageIds: [sk.id, foreign.id].join(',') }), 400, ERROR_CODE.EXPORT_LANGUAGES_INVALID)
		expectErrorCode(await exportCsv(app, cookie, project.id, { languageIds: '' }), 400, ERROR_CODE.VALIDATION_ERROR)
		expectErrorCode(await exportCsv(app, cookie, project.id, { languageIds: sk.id, status: 'REVIEWED' }), 400, ERROR_CODE.VALIDATION_ERROR)
	})

	it('returns 404 to a non-member and 401 without a session', async () => {
		const app = createTestApp()
		const { project, sk, cookie } = await setup(app, { member: false })

		expectErrorCode(await exportCsv(app, cookie, project.id, { languageIds: sk.id }), 404, ERROR_CODE.NOT_FOUND)
		expectErrorCode(await request(app).get(`/api/projects/${project.id}/export`).query({ languageIds: sk.id }), 401, ERROR_CODE.AUTH_UNAUTHENTICATED)
	})
})
