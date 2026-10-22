import { randomUUID } from 'node:crypto'

import request from 'supertest'
import { describe, expect, it } from 'vitest'

import {
	ACTIVITY_TYPE,
	ERROR_CODE,
	ROLE,
	VERSION_LOCK,
	createTranslationKeyResponseSchema,
	errorResponseSchema,
	importResultSchema,
	toVersionDate,
	translationsResponseSchema,
	updateTranslationResponseSchema,
} from '@locale/shared'

import { toDbDate } from '../src/lib/projectVersions'

import { createTestApp } from './helpers/app'
import { CSRF_HEADERS, loginAs } from './helpers/auth'
import { getTestPrisma } from './helpers/db'
import { TEST_PASSWORD, createUser } from './helpers/users'

type App = ReturnType<typeof createTestApp>

const expectErrorCode = (res: request.Response, status: number, code: ERROR_CODE) => {
	expect(res.status).toBe(status)
	expect(errorResponseSchema.parse(res.body).error.code).toBe(code)
}

const dayShift = (days: number) => toVersionDate(new Date(Date.now() + days * 86_400_000))

/** Logs in a new user (ADMIN member by default) with a new project with `sk` (base) and `en`. */
const setup = async (app: App, role: ROLE = ROLE.ADMIN) => {
	const { user } = await createUser({ role })
	const project = await getTestPrisma().project.create({
		data: { name: 'A', slug: `a-${randomUUID().slice(0, 8)}`, members: { create: { userId: user.id } } },
	})
	const sk = await getTestPrisma().projectLanguage.create({ data: { projectId: project.id, tag: 'sk', isBase: true } })
	const en = await getTestPrisma().projectLanguage.create({ data: { projectId: project.id, tag: 'en' } })
	return { user, project, sk, en, cookie: await loginAs(app, { email: user.email, password: TEST_PASSWORD }) }
}

/** A second member of the project with the given role. */
const addMember = async (app: App, projectId: string, role: ROLE) => {
	const { user } = await createUser({ role })
	await getTestPrisma().projectMember.create({ data: { projectId, userId: user.id } })
	return loginAs(app, { email: user.email, password: TEST_PASSWORD })
}

type VersionRow = { name: string; startsAt: string; endsAt: string; lock?: VERSION_LOCK }

const createVersion = (projectId: string, { name, startsAt, endsAt, lock }: VersionRow) =>
	getTestPrisma().projectVersion.create({ data: { projectId, name, startsAt: toDbDate(startsAt), endsAt: toDbDate(endsAt), lock } })

const createKey = (projectId: string, name: string, values: Record<string, string | null> = {}, versionId: string | null = null) =>
	getTestPrisma().translationKey.create({
		data: {
			projectId,
			namespace: 'loc',
			name,
			versionId,
			translations: { create: Object.entries(values).map(([languageId, value]) => ({ languageId, value, versionId })) },
		},
	})

const keyVersion = async (keyId: string) => (await getTestPrisma().translationKey.findUniqueOrThrow({ where: { id: keyId } })).versionId

const cellVersion = async (keyId: string, languageId: string) =>
	(await getTestPrisma().translation.findUniqueOrThrow({ where: { keyId_languageId: { keyId, languageId } } })).versionId

const put = (app: App, cookie: string, projectId: string, keyId: string, languageId: string, body: object) =>
	request(app).put(`/api/projects/${projectId}/keys/${keyId}/translations/${languageId}`).set('Cookie', cookie).set(CSRF_HEADERS).send(body)

const postKey = (app: App, cookie: string, projectId: string, body: object) =>
	request(app).post(`/api/projects/${projectId}/keys`).set('Cookie', cookie).set(CSRF_HEADERS).send(body)

const postImport = (app: App, cookie: string, projectId: string, lines: string[], columns: object[], versionId?: string | null) =>
	request(app)
		.post(`/api/projects/${projectId}/imports`)
		.set('Cookie', cookie)
		.set(CSRF_HEADERS)
		.send({ fileName: 'translations.csv', content: lines.join('\n'), columns, versionId })

const list = async (app: App, cookie: string, projectId: string, query: Record<string, string> = {}) => {
	const res = await request(app).get(`/api/projects/${projectId}/translations`).query(query).set('Cookie', cookie)
	expect(res.status).toBe(200)
	return translationsResponseSchema.strict().parse(res.body)
}

const exportCsv = (app: App, cookie: string, projectId: string, query: Record<string, string>) =>
	request(app).get(`/api/projects/${projectId}/export`).query(query).set('Cookie', cookie)

const names = (body: { items: { name: string }[] }) => body.items.map(({ name }) => name).sort()

describe('version of a cell edit', () => {
	it('writes the requested version when the value changes, keeps the old one when it does not, and the current one without a request', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app)
		const old = await createVersion(project.id, { name: 'v1', startsAt: dayShift(-40), endsAt: dayShift(-20) })
		const current = await createVersion(project.id, { name: 'v2', startsAt: dayShift(-5), endsAt: dayShift(5) })
		const key = await createKey(project.id, 'Uložiť', { [sk.id]: 'Uložiť', [en.id]: 'Save' }, old.id)

		expect((await put(app, cookie, project.id, key.id, en.id, { value: 'Save' })).status).toBe(200)
		expect(await cellVersion(key.id, en.id)).toBe(old.id)

		expect((await put(app, cookie, project.id, key.id, en.id, { value: 'Store' })).status).toBe(200)
		expect(await cellVersion(key.id, en.id)).toBe(current.id)

		expect((await put(app, cookie, project.id, key.id, sk.id, { value: 'Ulož', versionId: old.id })).status).toBe(200)
		expect(await cellVersion(key.id, sk.id)).toBe(old.id)
		expect(await keyVersion(key.id)).toBe(old.id)
	})

	it('writes no version in a project without one and rejects a version of another project', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app)
		const other = await setup(app)
		const foreign = await createVersion(other.project.id, { name: 'v1', startsAt: dayShift(-5), endsAt: dayShift(5) })
		const key = await createKey(project.id, 'Uložiť', { [sk.id]: 'Uložiť' })

		const res = await put(app, cookie, project.id, key.id, en.id, { value: 'Save' })
		expect(updateTranslationResponseSchema.parse(res.body).value).toBe('Save')
		expect(await cellVersion(key.id, en.id)).toBeNull()

		expectErrorCode(await put(app, cookie, project.id, key.id, en.id, { value: 'Store', versionId: foreign.id }), 404, ERROR_CODE.PROJECT_VERSION_NOT_FOUND)
		expect(await cellVersion(key.id, en.id)).toBeNull()
	})

	it('refuses an EDITOR in a locked version, also the current one locked by hand, and lets an ADMIN through', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie: adminCookie } = await setup(app)
		const editorCookie = await addMember(app, project.id, ROLE.EDITOR)
		const expired = await createVersion(project.id, { name: 'v1', startsAt: dayShift(-40), endsAt: dayShift(-20) })
		const reopened = await createVersion(project.id, { name: 'v2', startsAt: dayShift(-40), endsAt: dayShift(-20), lock: VERSION_LOCK.UNLOCKED })
		const key = await createKey(project.id, 'Uložiť', { [sk.id]: 'Uložiť' })

		expectErrorCode(
			await put(app, editorCookie, project.id, key.id, en.id, { value: 'Save', versionId: expired.id }),
			409,
			ERROR_CODE.PROJECT_VERSION_LOCKED,
		)
		expect(await cellVersion(key.id, en.id).catch(() => 'missing')).toBe('missing')
		expect((await put(app, editorCookie, project.id, key.id, en.id, { value: 'Save', versionId: reopened.id })).status).toBe(200)
		expect((await put(app, adminCookie, project.id, key.id, en.id, { value: 'Store', versionId: expired.id })).status).toBe(200)
		expect(await cellVersion(key.id, en.id)).toBe(expired.id)

		const current = await createVersion(project.id, { name: 'v3', startsAt: dayShift(-1), endsAt: dayShift(5), lock: VERSION_LOCK.LOCKED })
		expectErrorCode(await put(app, editorCookie, project.id, key.id, en.id, { value: 'Keep' }), 409, ERROR_CODE.PROJECT_VERSION_LOCKED)
		expect((await put(app, adminCookie, project.id, key.id, en.id, { value: 'Keep' })).status).toBe(200)
		expect(await cellVersion(key.id, en.id)).toBe(current.id)
	})
})

describe('version of a key added by hand', () => {
	it('stamps the key and its filled cells with the requested or current version and records nothing extra', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app)
		const current = await createVersion(project.id, { name: 'v2', startsAt: dayShift(-5), endsAt: dayShift(5) })
		const old = await createVersion(project.id, { name: 'v1', startsAt: dayShift(-40), endsAt: dayShift(-20) })
		await createKey(project.id, 'Existujúci', { [sk.id]: 'Existujúci' })

		const implicit = await postKey(app, cookie, project.id, { namespace: 'loc', name: 'Nový', translations: { [sk.id]: 'Nový', [en.id]: '' } })
		expect(implicit.status).toBe(201)
		const { keyId } = createTranslationKeyResponseSchema.parse(implicit.body)
		expect(await keyVersion(keyId)).toBe(current.id)
		expect(await cellVersion(keyId, sk.id)).toBe(current.id)

		const explicit = await postKey(app, cookie, project.id, { namespace: 'loc', name: 'Starý', versionId: old.id })
		expect(explicit.status).toBe(201)
		expect(await keyVersion(createTranslationKeyResponseSchema.parse(explicit.body).keyId)).toBe(old.id)

		const locked = await createVersion(project.id, { name: 'v0', startsAt: dayShift(-90), endsAt: dayShift(-60), lock: VERSION_LOCK.LOCKED })
		expect((await postKey(app, cookie, project.id, { namespace: 'loc', name: 'Admin smie', versionId: locked.id })).status).toBe(201)
		expect((await list(app, cookie, project.id)).items.map(({ name, version }) => [name, version?.name ?? null]).sort()).toEqual([
			['Admin smie', 'v0'],
			['Existujúci', null],
			['Nový', 'v2'],
			['Starý', 'v1'],
		])
	})
})

describe('version of an import', () => {
	const FILE = ['Keys; sk ; en', '--loc--', ' Uložiť; Uložiť; Save', ' Zrušiť; Zrušiť; Cancel', ' Nový; Nový; New']

	it('stamps created keys and written cells, leaves untouched cells alone and names the version in the result and the event', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app)
		const old = await createVersion(project.id, { name: 'v1', startsAt: dayShift(-40), endsAt: dayShift(-20) })
		const version = await createVersion(project.id, { name: 'v2', startsAt: dayShift(-5), endsAt: dayShift(5) })
		const unchanged = await createKey(project.id, 'Uložiť', { [sk.id]: 'Uložiť', [en.id]: 'Save' }, old.id)
		const changed = await createKey(project.id, 'Zrušiť', { [sk.id]: 'Zrušiť', [en.id]: 'Abort' }, old.id)
		const columns = [
			{ columnIndex: 2, languageId: sk.id },
			{ columnIndex: 3, languageId: en.id },
		]

		const res = await postImport(app, cookie, project.id, FILE, columns, version.id)

		expect(res.status).toBe(200)
		expect(importResultSchema.parse(res.body)).toMatchObject({ keysCreated: 1, translationsUpdated: 1, version: { id: version.id, name: 'v2' } })
		expect(await keyVersion(unchanged.id)).toBe(old.id)
		expect(await cellVersion(unchanged.id, en.id)).toBe(old.id)
		expect(await cellVersion(changed.id, sk.id)).toBe(old.id)
		expect(await cellVersion(changed.id, en.id)).toBe(version.id)
		const created = await getTestPrisma().translationKey.findFirstOrThrow({ where: { projectId: project.id, name: 'Nový' } })
		expect(created.versionId).toBe(version.id)
		expect(await cellVersion(created.id, sk.id)).toBe(version.id)
		const event = await getTestPrisma().activityEvent.findFirstOrThrow({ where: { projectId: project.id, type: ACTIVITY_TYPE.KEYS_IMPORTED } })
		expect(event.payload).toMatchObject({ versionName: 'v2' })
	})

	it('never guesses the current version: without versionId it writes none, and a foreign one is 404', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app)
		await createVersion(project.id, { name: 'v2', startsAt: dayShift(-5), endsAt: dayShift(5) })
		const other = await setup(app)
		const foreign = await createVersion(other.project.id, { name: 'x', startsAt: dayShift(-5), endsAt: dayShift(5) })
		const columns = [
			{ columnIndex: 2, languageId: sk.id },
			{ columnIndex: 3, languageId: en.id },
		]

		const res = await postImport(app, cookie, project.id, FILE, columns)
		expect(importResultSchema.parse(res.body).version).toBeNull()
		expect(await getTestPrisma().translationKey.count({ where: { projectId: project.id, versionId: null } })).toBe(3)

		expectErrorCode(await postImport(app, cookie, project.id, FILE, columns, foreign.id), 404, ERROR_CODE.PROJECT_VERSION_NOT_FOUND)
	})

	it('refuses a locked version to an EDITOR who could import', async () => {
		// Imports are ADMIN only today, so the lock is checked on the service with an EDITOR role directly.
		const { importFile, parseImportFile } = await import('../src/services/imports.service')
		const prisma = getTestPrisma()
		const { user } = await createUser({ role: ROLE.EDITOR })
		const project = await prisma.project.create({ data: { name: 'A', slug: `a-${randomUUID().slice(0, 8)}` } })
		const sk = await prisma.projectLanguage.create({ data: { projectId: project.id, tag: 'sk', isBase: true } })
		const locked = await createVersion(project.id, { name: 'v1', startsAt: dayShift(-40), endsAt: dayShift(-20) })
		const file = parseImportFile(['Keys; sk', '--loc--', ' a; A'].join('\n'))
		const request = {
			fileName: 'translations.csv',
			content: '',
			columns: [{ columnIndex: 2, languageId: sk.id }],
			createMissingKeys: true,
			versionId: locked.id,
		}

		await expect(importFile(prisma, { projectId: project.id, userId: user.id, role: ROLE.EDITOR }, file, request)).rejects.toMatchObject({
			code: ERROR_CODE.PROJECT_VERSION_LOCKED,
		})
		expect(await prisma.translationKey.count({ where: { projectId: project.id } })).toBe(0)
	})
})

describe('version filter and export scopes', () => {
	/** v1 (old): keys A (sk edited in v2), B. v2 (current): key C. No version: key D. v3 (upcoming): key E. */
	const seed = async (app: App) => {
		const context = await setup(app)
		const { project, sk, en } = context
		const v1 = await createVersion(project.id, { name: 'v1', startsAt: dayShift(-40), endsAt: dayShift(-20) })
		const v2 = await createVersion(project.id, { name: 'v2', startsAt: dayShift(-5), endsAt: dayShift(5) })
		const v3 = await createVersion(project.id, { name: 'v3', startsAt: dayShift(10), endsAt: dayShift(30) })
		const a = await createKey(project.id, 'A', { [sk.id]: 'A', [en.id]: 'A' }, v1.id)
		await getTestPrisma().translation.update({ where: { keyId_languageId: { keyId: a.id, languageId: sk.id } }, data: { versionId: v2.id } })
		await createKey(project.id, 'B', { [sk.id]: 'B', [en.id]: 'B' }, v1.id)
		await createKey(project.id, 'C', { [sk.id]: 'C', [en.id]: 'C' }, v2.id)
		await createKey(project.id, 'D', { [sk.id]: 'D', [en.id]: 'D' })
		await createKey(project.id, 'E', { [sk.id]: 'E', [en.id]: 'E' }, v3.id)
		return { ...context, v1, v2, v3 }
	}

	it('lists the work of a version: keys created in it or with a cell last written in it, with stats untouched', async () => {
		const app = createTestApp()
		const { project, cookie, v1, v2, v3 } = await seed(app)

		const inV2 = await list(app, cookie, project.id, { versionId: v2.id })
		expect(names(inV2)).toEqual(['A', 'C'])
		expect(inV2.total).toBe(2)
		expect(inV2.stats.totalKeys).toBe(5)
		expect(inV2.items.find(({ name }) => name === 'A')?.version).toEqual({ id: v1.id, name: 'v1' })
		expect(names(await list(app, cookie, project.id, { versionId: v1.id }))).toEqual(['A', 'B'])
		expect(names(await list(app, cookie, project.id, { versionId: v3.id, status: 'TRANSLATED' }))).toEqual(['E'])
		expect(names(await list(app, cookie, project.id, { versionId: randomUUID() }))).toEqual([])
		expect(names(await list(app, cookie, project.id, { versionId: '' }))).toEqual(['A', 'B', 'C', 'D', 'E'])
	})

	it('exports the project as of a version by default and only its work with versionScope=ONLY', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie, v1, v2 } = await seed(app)
		const languageIds = `${sk.id},${en.id}`
		const lines = (text: string) =>
			text
				.split('\n')
				.filter((line) => line.startsWith(' '))
				.map((line) => line.trim().split(';')[0])

		const asOfV1 = await exportCsv(app, cookie, project.id, { languageIds, versionId: v1.id })
		expect(asOfV1.status).toBe(200)
		expect(lines(asOfV1.text)).toEqual(['A', 'B', 'D'])

		const asOfV2 = await exportCsv(app, cookie, project.id, { languageIds, versionId: v2.id, versionScope: 'UP_TO' })
		expect(lines(asOfV2.text)).toEqual(['A', 'B', 'C', 'D'])

		const onlyV2 = await exportCsv(app, cookie, project.id, { languageIds, versionId: v2.id, versionScope: 'ONLY' })
		expect(lines(onlyV2.text)).toEqual(['A', 'C'])

		const all = await exportCsv(app, cookie, project.id, { languageIds, versionScope: 'ONLY' })
		expect(lines(all.text)).toEqual(['A', 'B', 'C', 'D', 'E'])

		const check = await request(app)
			.get(`/api/projects/${project.id}/export/check`)
			.query({ languageIds, versionId: v2.id, versionScope: 'ONLY' })
			.set('Cookie', cookie)
		expect(check.status).toBe(200)
	})

	it('rejects a foreign version and a bad scope', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await seed(app)
		const other = await setup(app)
		const foreign = await createVersion(other.project.id, { name: 'x', startsAt: dayShift(-5), endsAt: dayShift(5) })
		const languageIds = `${sk.id},${en.id}`

		expectErrorCode(await exportCsv(app, cookie, project.id, { languageIds, versionId: foreign.id }), 404, ERROR_CODE.PROJECT_VERSION_NOT_FOUND)
		expectErrorCode(await exportCsv(app, cookie, project.id, { languageIds, versionId: 'abc' }), 400, ERROR_CODE.VALIDATION_ERROR)
		expectErrorCode(await exportCsv(app, cookie, project.id, { languageIds, versionId: foreign.id, versionScope: 'ALL' }), 400, ERROR_CODE.VALIDATION_ERROR)
		expectErrorCode(
			await request(app).get(`/api/projects/${project.id}/export/check`).query({ languageIds, versionId: foreign.id }).set('Cookie', cookie),
			404,
			ERROR_CODE.PROJECT_VERSION_NOT_FOUND,
		)
	})
})
