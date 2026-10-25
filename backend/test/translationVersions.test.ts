import { randomUUID } from 'node:crypto'

import request from 'supertest'
import { describe, expect, it } from 'vitest'

import {
	ACTIVITY_TYPE,
	ERROR_CODE,
	activityDailyResponseSchema,
	activityListResponseSchema,
	dashboardResponseSchema,
	importPreviewResponseSchema,
	versionDiffSummarySchema,
	PROJECT_ROLE,
	ROLE,
	VERSION_LOCK,
	createTranslationKeyResponseSchema,
	errorResponseSchema,
	importResultSchema,
	projectVersionsResponseSchema,
	translationsResponseSchema,
} from '@locale/shared'

import { createTestApp } from './helpers/app'
import { CSRF_HEADERS, loginAs } from './helpers/auth'
import { getTestPrisma } from './helpers/db'
import { TEST_PASSWORD, createUser } from './helpers/users'
import { createVersionRow, dayShift } from './helpers/versions'

type App = ReturnType<typeof createTestApp>

const expectErrorCode = (res: request.Response, status: number, code: ERROR_CODE) => {
	expect(res.status).toBe(status)
	expect(errorResponseSchema.parse(res.body).error.code).toBe(code)
}

/** Logs in a new user (ADMIN member by default) with a new project with `sk` (base) and `en`, without versions. */
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
const addMember = async (app: App, projectId: string, role: PROJECT_ROLE) => {
	const { user } = await createUser({ role: ROLE.USER })
	await getTestPrisma().projectMember.create({ data: { projectId, userId: user.id, role } })
	return loginAs(app, { email: user.email, password: TEST_PASSWORD })
}

const PAST = { startsAt: dayShift(-40), endsAt: dayShift(-20) }
const RUNNING = { startsAt: dayShift(-5), endsAt: dayShift(5) }
const UPCOMING = { startsAt: dayShift(10), endsAt: dayShift(30) }

const createKey = (projectId: string, versionId: string, name: string, values: Record<string, string | null> = {}) =>
	getTestPrisma().translationKey.create({
		data: {
			projectId,
			versionId,
			namespace: 'loc',
			name,
			translations: { create: Object.entries(values).map(([languageId, value]) => ({ languageId, value })) },
		},
	})

const cellValue = async (keyId: string, languageId: string) =>
	(await getTestPrisma().translation.findUnique({ where: { keyId_languageId: { keyId, languageId } } }))?.value ?? null

const put = (app: App, cookie: string, projectId: string, keyId: string, languageId: string, body: object) =>
	request(app).put(`/api/projects/${projectId}/keys/${keyId}/translations/${languageId}`).set('Cookie', cookie).set(CSRF_HEADERS).send(body)

const postKey = (app: App, cookie: string, projectId: string, body: object) =>
	request(app).post(`/api/projects/${projectId}/keys`).set('Cookie', cookie).set(CSRF_HEADERS).send(body)

const postImport = (app: App, cookie: string, projectId: string, lines: string[], columns: object[], versionId?: string, createMissingKeys?: boolean) =>
	request(app)
		.post(`/api/projects/${projectId}/imports`)
		.set('Cookie', cookie)
		.set(CSRF_HEADERS)
		.send({ fileName: 'translations.csv', content: lines.join('\n'), columns, versionId, createMissingKeys })

const postPreview = (app: App, cookie: string, projectId: string, lines: string[], versionId: string) =>
	request(app)
		.post(`/api/projects/${projectId}/imports/preview`)
		.set('Cookie', cookie)
		.set(CSRF_HEADERS)
		.send({ fileName: 'translations.csv', content: lines.join('\n'), versionId })

const cellsOf = async (projectId: string, versionId: string, name: string) => {
	const key = await getTestPrisma().translationKey.findFirstOrThrow({ where: { projectId, versionId, name }, include: { translations: true } })
	return Object.fromEntries(key.translations.map((cell) => [cell.languageId, cell.value]))
}

const list = (app: App, cookie: string, projectId: string, query: Record<string, string> = {}) =>
	request(app).get(`/api/projects/${projectId}/translations`).query(query).set('Cookie', cookie)

const listOk = async (...args: Parameters<typeof list>) => {
	const res = await list(...args)
	expect(res.status).toBe(200)
	return translationsResponseSchema.strict().parse(res.body)
}

const exportCsv = (app: App, cookie: string, projectId: string, query: Record<string, string>) =>
	request(app).get(`/api/projects/${projectId}/export`).query(query).set('Cookie', cookie)

const names = (body: { items: { name: string }[] }) => body.items.map(({ name }) => name).sort()

const exportedKeys = (text: string) =>
	text
		.split('\n')
		.filter((line) => line.startsWith(' '))
		.map((line) => line.trim().split(';')[0])

describe('a cell edit stays in the version of its key', () => {
	it('lets an ADMIN and a MANAGER edit in any version and an EDITOR only in a running, unlocked one', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie: adminCookie } = await setup(app)
		const editorCookie = await addMember(app, project.id, PROJECT_ROLE.EDITOR)
		const managerCookie = await addMember(app, project.id, PROJECT_ROLE.MANAGER)
		const expired = await createVersionRow(project.id, { name: 'v1', ...PAST })
		const running = await createVersionRow(project.id, { name: 'v2', ...RUNNING })
		const upcoming = await createVersionRow(project.id, { name: 'v3', ...UPCOMING })
		const reopened = await createVersionRow(project.id, { name: 'v0', ...PAST, lock: VERSION_LOCK.UNLOCKED })
		const lockedByHand = await createVersionRow(project.id, { name: 'v4', ...RUNNING, lock: VERSION_LOCK.LOCKED })
		const inExpired = await createKey(project.id, expired.id, 'Uložiť', { [sk.id]: 'Uložiť' })
		const inRunning = await createKey(project.id, running.id, 'Uložiť', { [sk.id]: 'Uložiť' })
		const inUpcoming = await createKey(project.id, upcoming.id, 'Uložiť', { [sk.id]: 'Uložiť' })
		const inReopened = await createKey(project.id, reopened.id, 'Uložiť', { [sk.id]: 'Uložiť' })
		const inLockedByHand = await createKey(project.id, lockedByHand.id, 'Uložiť', { [sk.id]: 'Uložiť' })

		expectErrorCode(await put(app, editorCookie, project.id, inExpired.id, en.id, { value: 'Save' }), 409, ERROR_CODE.PROJECT_VERSION_LOCKED)
		expectErrorCode(await put(app, editorCookie, project.id, inUpcoming.id, en.id, { value: 'Save' }), 409, ERROR_CODE.PROJECT_VERSION_LOCKED)
		expectErrorCode(await put(app, editorCookie, project.id, inLockedByHand.id, en.id, { value: 'Save' }), 409, ERROR_CODE.PROJECT_VERSION_LOCKED)
		expect(await cellValue(inExpired.id, en.id)).toBeNull()
		expect((await put(app, editorCookie, project.id, inRunning.id, en.id, { value: 'Save' })).status).toBe(200)
		expect((await put(app, editorCookie, project.id, inReopened.id, en.id, { value: 'Save' })).status).toBe(200)

		expect((await put(app, adminCookie, project.id, inExpired.id, en.id, { value: 'Store' })).status).toBe(200)
		expect((await put(app, adminCookie, project.id, inUpcoming.id, en.id, { value: 'Store' })).status).toBe(200)
		expect(await cellValue(inExpired.id, en.id)).toBe('Store')
		expect((await put(app, managerCookie, project.id, inLockedByHand.id, en.id, { value: 'Keep' })).status).toBe(200)
		// The copies are independent: the running version's cell keeps the editor's value.
		expect(await cellValue(inRunning.id, en.id)).toBe('Save')
	})
})

describe('a key added by hand goes into the requested version', () => {
	it('requires the version, checks the namespace within it and refuses a locked one to an EDITOR', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app)
		const editorCookie = await addMember(app, project.id, PROJECT_ROLE.EDITOR)
		const running = await createVersionRow(project.id, { name: 'v2', ...RUNNING })
		const expired = await createVersionRow(project.id, { name: 'v1', ...PAST })
		await createKey(project.id, running.id, 'Existujúci', { [sk.id]: 'Existujúci' })
		await createKey(project.id, expired.id, 'Existujúci', { [sk.id]: 'Existujúci' })

		const missing = await postKey(app, cookie, project.id, { namespace: 'loc', name: 'Nový' })
		expectErrorCode(missing, 400, ERROR_CODE.VALIDATION_ERROR)

		const created = await postKey(app, cookie, project.id, {
			namespace: 'loc',
			name: 'Nový',
			versionId: running.id,
			translations: { [sk.id]: 'Nový', [en.id]: '' },
		})
		expect(created.status).toBe(201)
		const { keyId } = createTranslationKeyResponseSchema.parse(created.body)
		expect((await getTestPrisma().translationKey.findUniqueOrThrow({ where: { id: keyId } })).versionId).toBe(running.id)

		// The same name exists in the expired version, which is another copy: no conflict.
		expect((await postKey(app, cookie, project.id, { namespace: 'loc', name: 'Nový', versionId: expired.id })).status).toBe(201)
		expectErrorCode(
			await postKey(app, cookie, project.id, { namespace: 'loc', name: 'Nový', versionId: running.id }),
			409,
			ERROR_CODE.TRANSLATION_KEY_TAKEN,
		)

		// Keys are ADMIN only, so the lock is checked with the ADMIN role only for the foreign version; an EDITOR gets 403 before it.
		const other = await setup(app)
		const foreign = await createVersionRow(other.project.id, { name: 'x', ...RUNNING })
		expectErrorCode(
			await postKey(app, cookie, project.id, { namespace: 'loc', name: 'Cudzí', versionId: foreign.id }),
			404,
			ERROR_CODE.PROJECT_VERSION_NOT_FOUND,
		)
		expect((await postKey(app, editorCookie, project.id, { namespace: 'loc', name: 'Editor', versionId: running.id })).status).toBe(403)

		expect(names(await listOk(app, cookie, project.id, { versionId: running.id }))).toEqual(['Existujúci', 'Nový'])
		expect(names(await listOk(app, cookie, project.id, { versionId: expired.id }))).toEqual(['Existujúci', 'Nový'])
	})
})

describe('an import fills one version', () => {
	const FILE = ['Keys; sk ; en', '--loc--', ' Uložiť; Uložiť; Save', ' Zrušiť; Zrušiť; Cancel', ' Nový; Nový; New']

	it('creates the keys in the version, remembers the import and names the version in the result and the event', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app)
		const old = await createVersionRow(project.id, { name: 'v1', ...PAST, importedAt: null })
		const version = await createVersionRow(project.id, { name: 'v2', ...RUNNING, importedAt: null })
		const inOld = await createKey(project.id, old.id, 'Uložiť', { [sk.id]: 'Uložiť', [en.id]: 'Store' })
		const columns = [
			{ columnIndex: 2, languageId: sk.id },
			{ columnIndex: 3, languageId: en.id },
		]

		const res = await postImport(app, cookie, project.id, FILE, columns, version.id)

		expect(res.status).toBe(200)
		// Uložiť is copied from v1 (sk kept, en Store → Save), the other two keys are new.
		expect(importResultSchema.parse(res.body)).toEqual({
			keysCreated: 2,
			keysCopied: 1,
			keysRemoved: 0,
			translationsCreated: 4,
			translationsUpdated: 1,
			skippedColumns: 0,
			version: { id: version.id, name: 'v2' },
		})
		expect(names(await listOk(app, cookie, project.id, { versionId: version.id }))).toEqual(['Nový', 'Uložiť', 'Zrušiť'])
		expect(names(await listOk(app, cookie, project.id, { versionId: old.id }))).toEqual(['Uložiť'])
		expect(await cellValue(inOld.id, en.id)).toBe('Store')
		const stored = await getTestPrisma().projectVersion.findUniqueOrThrow({ where: { id: version.id } })
		expect(stored.importedAt).not.toBeNull()
		expect((await getTestPrisma().projectVersion.findUniqueOrThrow({ where: { id: old.id } })).importedAt).toBeNull()
		const event = await getTestPrisma().activityEvent.findFirstOrThrow({ where: { projectId: project.id, type: ACTIVITY_TYPE.KEYS_IMPORTED } })
		expect(event.payload).toMatchObject({ versionName: 'v2' })

		const versions = await request(app).get(`/api/projects/${project.id}/versions`).set('Cookie', cookie)
		expect(projectVersionsResponseSchema.parse(versions.body).items.map(({ name, keyCount, importedAt }) => [name, keyCount, importedAt !== null])).toEqual(
			[
				['v2', 3, true],
				['v1', 1, false],
			],
		)
	})

	it('never guesses the version: without one it is 400, a foreign one 404', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app)
		await createVersionRow(project.id, { name: 'v2', ...RUNNING })
		const other = await setup(app)
		const foreign = await createVersionRow(other.project.id, { name: 'x', ...RUNNING })
		const columns = [
			{ columnIndex: 2, languageId: sk.id },
			{ columnIndex: 3, languageId: en.id },
		]

		expectErrorCode(await postImport(app, cookie, project.id, FILE, columns), 400, ERROR_CODE.VALIDATION_ERROR)
		expectErrorCode(await postImport(app, cookie, project.id, FILE, columns, foreign.id), 404, ERROR_CODE.PROJECT_VERSION_NOT_FOUND)
		expect(await getTestPrisma().translationKey.count({ where: { projectId: project.id } })).toBe(0)
	})

	it('refuses a locked version to an EDITOR who could import', async () => {
		// Imports are ADMIN only today, so the lock is checked on the service with an EDITOR role directly.
		const { importFile, parseImportFile } = await import('../src/services/imports.service')
		const prisma = getTestPrisma()
		const { user } = await createUser({ role: ROLE.USER })
		const project = await prisma.project.create({ data: { name: 'A', slug: `a-${randomUUID().slice(0, 8)}` } })
		const sk = await prisma.projectLanguage.create({ data: { projectId: project.id, tag: 'sk', isBase: true } })
		const locked = await createVersionRow(project.id, { name: 'v1', ...PAST })
		const file = parseImportFile(['Keys; sk', '--loc--', ' a; A'].join('\n'))
		const body = {
			fileName: 'translations.csv',
			content: '',
			columns: [{ columnIndex: 2, languageId: sk.id }],
			createMissingKeys: true,
			versionId: locked.id,
		}

		await expect(importFile(prisma, { projectId: project.id, userId: user.id, role: PROJECT_ROLE.EDITOR }, file, body)).rejects.toMatchObject({
			code: ERROR_CODE.PROJECT_VERSION_LOCKED,
		})
		expect(await prisma.translationKey.count({ where: { projectId: project.id } })).toBe(0)
	})
})

describe('the list and the export read one version', () => {
	/** v1 (old): keys A, B. v2 (running): keys A (sk changed), C. */
	const seed = async (app: App) => {
		const context = await setup(app)
		const { project, sk, en } = context
		const v1 = await createVersionRow(project.id, { name: 'v1', ...PAST })
		const v2 = await createVersionRow(project.id, { name: 'v2', ...RUNNING })
		await createKey(project.id, v1.id, 'A', { [sk.id]: 'A', [en.id]: 'A' })
		await createKey(project.id, v1.id, 'B', { [sk.id]: 'B', [en.id]: 'B' })
		await createKey(project.id, v2.id, 'A', { [sk.id]: 'A2', [en.id]: 'A' })
		await createKey(project.id, v2.id, 'C', { [sk.id]: 'C' })
		return { ...context, v1, v2 }
	}

	it('lists the keys of the version with its own stats, namespaces and editors; the version is required', async () => {
		const app = createTestApp()
		const { project, cookie, v1, v2 } = await seed(app)

		const inV2 = await listOk(app, cookie, project.id, { versionId: v2.id })
		expect(names(inV2)).toEqual(['A', 'C'])
		expect(inV2.total).toBe(2)
		expect(inV2.stats).toEqual({ totalKeys: 2, translated: 1, untranslated: 1, warnings: 0, untranslatedByLanguage: expect.any(Object) as unknown })
		const inV1 = await listOk(app, cookie, project.id, { versionId: v1.id })
		expect(names(inV1)).toEqual(['A', 'B'])
		expect(inV1.stats.totalKeys).toBe(2)
		expect(names(await listOk(app, cookie, project.id, { versionId: v2.id, status: 'UNTRANSLATED' }))).toEqual(['C'])

		expectErrorCode(await list(app, cookie, project.id), 400, ERROR_CODE.VALIDATION_ERROR)
		expectErrorCode(await list(app, cookie, project.id, { versionId: '' }), 400, ERROR_CODE.VALIDATION_ERROR)
		expectErrorCode(await list(app, cookie, project.id, { versionId: randomUUID() }), 404, ERROR_CODE.PROJECT_VERSION_NOT_FOUND)
	})

	it('exports the file of the version and rejects a missing or foreign one', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie, v1, v2 } = await seed(app)
		const other = await setup(app)
		const foreign = await createVersionRow(other.project.id, { name: 'x', ...RUNNING })
		const languageIds = `${sk.id},${en.id}`

		const ofV1 = await exportCsv(app, cookie, project.id, { languageIds, versionId: v1.id })
		expect(ofV1.status).toBe(200)
		expect(exportedKeys(ofV1.text)).toEqual(['A', 'B'])
		const ofV2 = await exportCsv(app, cookie, project.id, { languageIds, versionId: v2.id })
		expect(exportedKeys(ofV2.text)).toEqual(['A', 'C'])
		expect(ofV2.text).toContain('A2')

		expectErrorCode(await exportCsv(app, cookie, project.id, { languageIds }), 400, ERROR_CODE.VALIDATION_ERROR)
		expectErrorCode(await exportCsv(app, cookie, project.id, { languageIds, versionId: foreign.id }), 404, ERROR_CODE.PROJECT_VERSION_NOT_FOUND)
		const check = await request(app).get(`/api/projects/${project.id}/export/check`).query({ languageIds, versionId: v2.id }).set('Cookie', cookie)
		expect(check.status).toBe(200)
		expectErrorCode(
			await request(app).get(`/api/projects/${project.id}/export/check`).query({ languageIds, versionId: foreign.id }).set('Cookie', cookie),
			404,
			ERROR_CODE.PROJECT_VERSION_NOT_FOUND,
		)
	})
})

describe('an import copies the previous version and defines the key set', () => {
	const COLUMNS = (sk: { id: string }, en: { id: string }) => [
		{ columnIndex: 2, languageId: sk.id },
		{ columnIndex: 3, languageId: en.id },
	]

	it('previews and performs the copy of the nearest older version, the new keys and the removal of keys missing from the file', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app)
		const older = await createVersionRow(project.id, { name: 'v1', startsAt: dayShift(-90), endsAt: dayShift(-70) })
		const previous = await createVersionRow(project.id, { name: 'v2', ...PAST })
		const version = await createVersionRow(project.id, { name: 'v3', ...RUNNING })
		await createKey(project.id, older.id, 'Zo starej', { [sk.id]: 'Stará' })
		await createKey(project.id, previous.id, 'Uložiť', { [sk.id]: 'Uložiť', [en.id]: 'Save' })
		await createKey(project.id, previous.id, 'Zrušiť', { [sk.id]: 'Zrušiť', [en.id]: 'Cancel' })
		await createKey(project.id, previous.id, 'Zmizne', { [sk.id]: 'Zmizne' })
		await createKey(project.id, version.id, 'Vlastný', { [sk.id]: 'Vlastný' })
		await createKey(project.id, version.id, 'Odstránený', { [sk.id]: 'Odstránený' })
		const file = ['Keys; sk ; en', '--loc--', ' Uložiť; Uložiť; Save', ' Zrušiť; Zrušiť; Abort', ' Vlastný; Vlastný; Own', ' Nový; Nový; New']

		const preview = await postPreview(app, cookie, project.id, file, version.id)
		expect(preview.status).toBe(200)
		expect(importPreviewResponseSchema.parse(preview.body)).toMatchObject({
			keys: { total: 4, new: 1, existing: 1, copiedFromPrevious: 2 },
			changes: [
				{ tag: 'sk', new: 1, changed: 0, unchanged: 3 },
				{ tag: 'en', new: 2, changed: 1, unchanged: 1 },
			],
			previousVersion: { id: previous.id, name: 'v2' },
			removed: { total: 1, names: ['loc:Odstránený'] },
		})

		const res = await postImport(app, cookie, project.id, file, COLUMNS(sk, en), version.id)
		expect(res.status).toBe(200)
		expect(importResultSchema.parse(res.body)).toEqual({
			keysCreated: 1,
			keysCopied: 2,
			keysRemoved: 1,
			translationsCreated: 3,
			translationsUpdated: 1,
			skippedColumns: 0,
			version: { id: version.id, name: 'v3' },
		})
		expect(names(await listOk(app, cookie, project.id, { versionId: version.id }))).toEqual(['Nový', 'Uložiť', 'Vlastný', 'Zrušiť'])
		expect(await cellsOf(project.id, version.id, 'Zrušiť')).toEqual({ [sk.id]: 'Zrušiť', [en.id]: 'Abort' })
		expect(await cellsOf(project.id, version.id, 'Uložiť')).toEqual({ [sk.id]: 'Uložiť', [en.id]: 'Save' })
		// The previous version is untouched, also the key the file left out.
		expect(names(await listOk(app, cookie, project.id, { versionId: previous.id }))).toEqual(['Uložiť', 'Zmizne', 'Zrušiť'])
		expect(await cellsOf(project.id, previous.id, 'Zrušiť')).toEqual({ [sk.id]: 'Zrušiť', [en.id]: 'Cancel' })
		const event = await getTestPrisma().activityEvent.findFirstOrThrow({ where: { projectId: project.id, type: ACTIVITY_TYPE.KEYS_IMPORTED } })
		expect(event.payload).toMatchObject({ keysCreated: 1, keysCopied: 2, keysRemoved: 1, versionName: 'v3' })
	})

	it('copies nothing for the first version, keeps copying with createMissingKeys false and removes keys of an emptied file', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app)
		const first = await createVersionRow(project.id, { name: 'v1', ...PAST })
		const second = await createVersionRow(project.id, { name: 'v2', ...RUNNING })
		const file = ['Keys; sk ; en', '--loc--', ' Uložiť; Uložiť; Save', ' Nový; Nový; New']

		const preview = await postPreview(app, cookie, project.id, file, first.id)
		expect(importPreviewResponseSchema.parse(preview.body)).toMatchObject({
			keys: { copiedFromPrevious: 0, new: 2 },
			previousVersion: null,
			removed: { total: 0, names: [] },
		})
		expect(importResultSchema.parse((await postImport(app, cookie, project.id, file, COLUMNS(sk, en), first.id)).body)).toMatchObject({
			keysCreated: 2,
			keysCopied: 0,
			keysRemoved: 0,
		})

		// Without creating new keys the second version still gets the copies of the first.
		const onlyKnown = ['Keys; sk ; en', '--loc--', ' Uložiť; Uložiť; Store', ' Neznámy; Neznámy; Unknown']
		expect(importResultSchema.parse((await postImport(app, cookie, project.id, onlyKnown, COLUMNS(sk, en), second.id, false)).body)).toMatchObject({
			keysCreated: 0,
			keysCopied: 1,
			keysRemoved: 0,
			translationsUpdated: 1,
		})
		expect(names(await listOk(app, cookie, project.id, { versionId: second.id }))).toEqual(['Uložiť'])
		expect(await cellsOf(project.id, second.id, 'Uložiť')).toEqual({ [sk.id]: 'Uložiť', [en.id]: 'Store' })

		const empty = ['Keys; sk ; en', '--loc--', ' Nový; Nový; New']
		expect(importResultSchema.parse((await postImport(app, cookie, project.id, empty, COLUMNS(sk, en), second.id)).body)).toMatchObject({
			keysCreated: 0,
			keysCopied: 1,
			keysRemoved: 1,
		})
		expect(names(await listOk(app, cookie, project.id, { versionId: second.id }))).toEqual(['Nový'])
	})
})

describe('a key by hand needs an imported version', () => {
	it('refuses an empty version with 409 PROJECT_VERSION_EMPTY', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app)
		const empty = await createVersionRow(project.id, { name: 'v1', ...RUNNING, importedAt: null })

		expectErrorCode(await postKey(app, cookie, project.id, { namespace: 'loc', name: 'Nový', versionId: empty.id }), 409, ERROR_CODE.PROJECT_VERSION_EMPTY)

		const file = ['Keys; sk ; en', '--loc--', ' Uložiť; Uložiť; Save']
		expect((await postImport(app, cookie, project.id, file, COLUMNS(sk, en), empty.id)).status).toBe(200)
		expect((await postKey(app, cookie, project.id, { namespace: 'loc', name: 'Nový', versionId: empty.id })).status).toBe(201)
	})

	const COLUMNS = (sk: { id: string }, en: { id: string }) => [
		{ columnIndex: 2, languageId: sk.id },
		{ columnIndex: 3, languageId: en.id },
	]
})

describe('export of the diff', () => {
	it('exports only the keys added or changed against the previous version with diffOnly, everything without one', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app)
		const previous = await createVersionRow(project.id, { name: 'v1', ...PAST })
		const version = await createVersionRow(project.id, { name: 'v2', ...RUNNING })
		await createKey(project.id, previous.id, 'Rovnaký', { [sk.id]: 'A', [en.id]: 'A' })
		await createKey(project.id, previous.id, 'Zmenený', { [sk.id]: 'B', [en.id]: 'B' })
		await createKey(project.id, previous.id, 'Doplnený', { [sk.id]: 'C' })
		await createKey(project.id, previous.id, 'Popis', { [sk.id]: 'D' })
		await createKey(project.id, version.id, 'Rovnaký', { [sk.id]: 'A', [en.id]: 'A' })
		await createKey(project.id, version.id, 'Zmenený', { [sk.id]: 'B', [en.id]: 'B2' })
		await createKey(project.id, version.id, 'Doplnený', { [sk.id]: 'C', [en.id]: 'C' })
		await createKey(project.id, version.id, 'Pridaný', { [sk.id]: 'E' })
		const withDescription = await createKey(project.id, version.id, 'Popis', { [sk.id]: 'D' })
		await getTestPrisma().translationKey.update({ where: { id: withDescription.id }, data: { description: 'Popis' } })
		const languageIds = `${sk.id},${en.id}`

		const diff = await exportCsv(app, cookie, project.id, { languageIds, versionId: version.id, diffOnly: 'true' })
		expect(diff.status).toBe(200)
		expect(exportedKeys(diff.text)).toEqual(['Doplnený', 'Popis', 'Pridaný', 'Zmenený'])
		expect(exportedKeys((await exportCsv(app, cookie, project.id, { languageIds, versionId: version.id })).text)).toEqual([
			'Doplnený',
			'Popis',
			'Pridaný',
			'Rovnaký',
			'Zmenený',
		])
		expect(exportedKeys((await exportCsv(app, cookie, project.id, { languageIds, versionId: previous.id, diffOnly: '1' })).text)).toEqual([
			'Doplnený',
			'Popis',
			'Rovnaký',
			'Zmenený',
		])
		const check = await request(app)
			.get(`/api/projects/${project.id}/export/check`)
			.query({ languageIds, versionId: version.id, diffOnly: 'true' })
			.set('Cookie', cookie)
		expect(check.status).toBe(200)
	})
})

describe('the diff of a version', () => {
	/** v1: A, B (sk B), C. v2: A (same), B (sk changed, description added), D (new). */
	const seed = async (app: App) => {
		const context = await setup(app)
		const { project, sk, en } = context
		const previous = await createVersionRow(project.id, { name: 'v1', ...PAST })
		const version = await createVersionRow(project.id, { name: 'v2', ...RUNNING })
		await createKey(project.id, previous.id, 'A', { [sk.id]: 'A', [en.id]: 'A' })
		await createKey(project.id, previous.id, 'B', { [sk.id]: 'B' })
		await createKey(project.id, previous.id, 'C', { [sk.id]: 'C' })
		await createKey(project.id, version.id, 'A', { [sk.id]: 'A', [en.id]: 'A' })
		const changed = await createKey(project.id, version.id, 'B', { [sk.id]: 'B2' })
		await getTestPrisma().translationKey.update({ where: { id: changed.id }, data: { description: 'Popis' } })
		await createKey(project.id, version.id, 'D', { [sk.id]: 'D', [en.id]: 'D' })
		return { ...context, previous, version }
	}

	it('marks what changed on every key, lists only the added and changed ones with diff=true and sums them up per version', async () => {
		const app = createTestApp()
		const { project, sk, cookie, previous, version } = await seed(app)

		const diff = await listOk(app, cookie, project.id, { versionId: version.id, diff: 'true' })
		expect(diff.items.map(({ name, diff: change }) => [name, change?.added, change?.changedLanguageIds]).sort()).toEqual([
			['B', false, [sk.id]],
			['D', true, []],
		])
		// The previous value of every changed language comes along, for the editor to compare.
		expect(diff.items.find(({ name }) => name === 'B')?.diff?.previousValues).toEqual({ [sk.id]: 'B' })
		expect(diff.items.find(({ name }) => name === 'D')?.diff?.previousValues).toEqual({})
		expect(diff.total).toBe(2)
		expect(diff.stats.totalKeys).toBe(3)
		const all = await listOk(app, cookie, project.id, { versionId: version.id })
		expect(all.items.map(({ name, diff: change }) => [name, change?.added, change?.changedLanguageIds]).sort()).toEqual([
			['A', false, []],
			['B', false, [sk.id]],
			['D', true, []],
		])
		// The first version has no previous one: the filter keeps every key, none carries a diff.
		const first = await listOk(app, cookie, project.id, { versionId: previous.id, diff: '1' })
		expect(first.items.map(({ name }) => name).sort()).toEqual(['A', 'B', 'C'])
		expect(first.items.every((item) => item.diff === undefined)).toBe(true)

		const summary = await request(app).get(`/api/projects/${project.id}/versions/${version.id}/diff`).set('Cookie', cookie)
		expect(summary.status).toBe(200)
		expect(versionDiffSummarySchema.parse(summary.body)).toEqual({ previousVersion: { id: previous.id, name: 'v1' }, added: 1, changed: 1, removed: 1 })
		const firstSummary = await request(app).get(`/api/projects/${project.id}/versions/${previous.id}/diff`).set('Cookie', cookie)
		expect(versionDiffSummarySchema.parse(firstSummary.body)).toEqual({ previousVersion: null, added: 3, changed: 0, removed: 0 })
		expectErrorCode(
			await request(app).get(`/api/projects/${project.id}/versions/${randomUUID()}/diff`).set('Cookie', cookie),
			404,
			ERROR_CODE.PROJECT_VERSION_NOT_FOUND,
		)
	})
})

describe('deleting a version', () => {
	const del = (app: App, cookie: string, projectId: string, versionId: string) =>
		request(app).delete(`/api/projects/${projectId}/versions/${versionId}`).set('Cookie', cookie).set(CSRF_HEADERS).send({})

	it('removes the version with its keys and cells, records VERSION_DELETED and refuses the current version and an EDITOR', async () => {
		const app = createTestApp()
		const { project, sk, cookie } = await setup(app)
		const editorCookie = await addMember(app, project.id, PROJECT_ROLE.EDITOR)
		const old = await createVersionRow(project.id, { name: 'v1', ...PAST })
		const current = await createVersionRow(project.id, { name: 'v2', ...RUNNING })
		const key = await createKey(project.id, old.id, 'A', { [sk.id]: 'A' })
		await createKey(project.id, current.id, 'A', { [sk.id]: 'A' })
		await getTestPrisma().activityEvent.create({
			data: {
				projectId: project.id,
				versionId: old.id,
				type: ACTIVITY_TYPE.KEY_CREATED,
				payload: { keyId: key.id, namespace: 'loc', name: 'A', languageTags: ['sk'] },
			},
		})

		expect((await del(app, editorCookie, project.id, old.id)).status).toBe(403)
		expectErrorCode(await del(app, cookie, project.id, current.id), 409, ERROR_CODE.PROJECT_VERSION_CURRENT)
		expectErrorCode(await del(app, cookie, project.id, randomUUID()), 404, ERROR_CODE.PROJECT_VERSION_NOT_FOUND)

		expect((await del(app, cookie, project.id, old.id)).status).toBe(204)
		expect(await getTestPrisma().projectVersion.findUnique({ where: { id: old.id } })).toBeNull()
		expect(await getTestPrisma().translationKey.count({ where: { projectId: project.id } })).toBe(1)
		expect(await getTestPrisma().translation.count({ where: { key: { projectId: project.id } } })).toBe(1)
		const events = await getTestPrisma().activityEvent.findMany({ where: { projectId: project.id }, orderBy: { createdAt: 'asc' } })
		expect(events.map(({ type, versionId, payload }) => [type, versionId, payload])).toEqual([
			[ACTIVITY_TYPE.KEY_CREATED, null, { keyId: key.id, namespace: 'loc', name: 'A', languageTags: ['sk'] }],
			[ACTIVITY_TYPE.VERSION_DELETED, null, { name: 'v1', keyCount: 1 }],
		])
		const list = await request(app).get(`/api/projects/${project.id}/activity`).set('Cookie', cookie)
		expect(activityListResponseSchema.parse(list.body).items.map((item) => [item.type, item.version])).toEqual([
			[ACTIVITY_TYPE.VERSION_DELETED, null],
			[ACTIVITY_TYPE.KEY_CREATED, null],
		])
	})
})

describe('the dashboard and the daily activity of a version', () => {
	it('sums up the requested version, the default one without a request, and nothing without versions', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app)
		const empty = await request(app).get(`/api/projects/${project.id}/dashboard`).set('Cookie', cookie)
		expect(dashboardResponseSchema.parse(empty.body)).toEqual({
			version: null,
			keys: { total: 0, createdLast30Days: 0 },
			translatedKeys: 0,
			strings: { filled: 0, total: 0 },
			baseWords: 0,
		})

		const old = await createVersionRow(project.id, { name: 'v1', ...PAST })
		const current = await createVersionRow(project.id, { name: 'v2', ...RUNNING })
		await createKey(project.id, old.id, 'A', { [sk.id]: 'A' })
		await createKey(project.id, current.id, 'A', { [sk.id]: 'jeden dva', [en.id]: 'A' })
		await createKey(project.id, current.id, 'B', { [sk.id]: 'tri' })

		const byDefault = await request(app).get(`/api/projects/${project.id}/dashboard`).set('Cookie', cookie)
		expect(dashboardResponseSchema.parse(byDefault.body)).toEqual({
			version: { id: current.id, name: 'v2' },
			keys: { total: 2, createdLast30Days: 2 },
			translatedKeys: 1,
			strings: { filled: 3, total: 4 },
			baseWords: 3,
		})
		const requested = await request(app).get(`/api/projects/${project.id}/dashboard`).query({ versionId: old.id }).set('Cookie', cookie)
		expect(dashboardResponseSchema.parse(requested.body)).toMatchObject({
			version: { id: old.id, name: 'v1' },
			keys: { total: 1 },
			strings: { filled: 1, total: 2 },
		})
		expectErrorCode(
			await request(app).get(`/api/projects/${project.id}/dashboard`).query({ versionId: randomUUID() }).set('Cookie', cookie),
			404,
			ERROR_CODE.PROJECT_VERSION_NOT_FOUND,
		)

		// The daily chart counts the version's events and the project-level ones; the other version's events stay out.
		const { user } = await setup(app)
		const event = (versionId: string | null, count: number) =>
			getTestPrisma().activityEvent.create({
				data: { projectId: project.id, userId: user.id, versionId, count, type: ACTIVITY_TYPE.LANGUAGE_ADDED, payload: { tag: 'en' } },
			})
		await event(current.id, 5)
		await event(old.id, 7)
		await event(null, 1)
		const daily = await request(app).get(`/api/projects/${project.id}/activity/daily`).query({ range: '7d' }).set('Cookie', cookie)
		expect(activityDailyResponseSchema.parse(daily.body).days.reduce((sum, day) => sum + day.changes, 0)).toBe(6)
		const oldDaily = await request(app).get(`/api/projects/${project.id}/activity/daily`).query({ range: '7d', versionId: old.id }).set('Cookie', cookie)
		expect(activityDailyResponseSchema.parse(oldDaily.body).days.reduce((sum, day) => sum + day.changes, 0)).toBe(8)
	})
})
