import { randomUUID } from 'node:crypto'

import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'

import {
	ERROR_CODE,
	IMPORT_FILE_MAX_BYTES,
	IMPORT_ISSUES_MAX,
	IMPORT_KEY_MAX_BYTES,
	IMPORT_NAMESPACE_MAX_LENGTH,
	IMPORT_WARNINGS_MAX,
	ROLE,
	errorResponseSchema,
	importFileInvalidDetailsSchema,
	importPreviewResponseSchema,
	importResultSchema,
	type ImportRequestInput,
	type ImportIssue,
} from '@locale/shared'

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

const createLanguage = (projectId: string, tag: string, isBase = false) => getTestPrisma().projectLanguage.create({ data: { projectId, tag, isBase } })

/** `values` maps a language id to its value; a language left out has no row. */
const createKey = (projectId: string, namespace: string, name: string, values: Record<string, string | null> = {}) =>
	getTestPrisma().translationKey.create({
		data: { projectId, namespace, name, translations: { create: Object.entries(values).map(([languageId, value]) => ({ languageId, value })) } },
	})

/** Logs in a new user (ADMIN unless given, only an ADMIN imports) who is a member of a new project with `sk` (base), `en` and `cs`. */
const setup = async (app: App, role: ROLE = ROLE.ADMIN, { member = true }: { member?: boolean } = {}) => {
	const { user } = await createUser({ role })
	const project = await createProject(member ? [user.id] : [])
	const sk = await createLanguage(project.id, 'sk', true)
	const en = await createLanguage(project.id, 'en')
	const cs = await createLanguage(project.id, 'cs')
	return { user, project, sk, en, cs, cookie: await loginAs(app, { email: user.email, password: TEST_PASSWORD }) }
}

const preview = (app: App, cookie: string, projectId: string, body: object) =>
	request(app).post(`/api/projects/${projectId}/imports/preview`).set('Cookie', cookie).set(CSRF_HEADERS).send(body)

const previewCsv = (app: App, cookie: string, projectId: string, lines: string[]) =>
	preview(app, cookie, projectId, { fileName: 'translations.csv', content: lines.join('\n') })

const previewOk = async (...args: Parameters<typeof previewCsv>) => {
	const res = await previewCsv(...args)
	expect(res.status).toBe(200)
	return importPreviewResponseSchema.strict().parse(res.body)
}

const fileIssues = (res: request.Response) => {
	expectErrorCode(res, 422, ERROR_CODE.IMPORT_FILE_INVALID)
	return importFileInvalidDetailsSchema.parse(errorResponseSchema.parse(res.body).error.details)
}

const countRows = async () => {
	const prisma = getTestPrisma()
	return { keys: await prisma.translationKey.count(), translations: await prisma.translation.count(), languages: await prisma.projectLanguage.count() }
}

const SAMPLE = [
	'Keys; sk ; EN ; cs ; de-AT ; pl ',
	'--loc--',
	' Uložiť; Uložiť; Save; Uložit; Speichern; Zapisz',
	' Zrušiť; Zrušiť; Abort; null; Abbrechen; Anuluj',
	' Máte {{ count }} položiek; Máte {{ count }} položiek; You have {{count}} items; Máte {{ total }} položek; null; Masz {{count}} {{x}}',
	' Existujúci bez prekladov; null; ""; null; null; null',
	'--paths--',
	' orders; /objednavky; /orders; null; null; null',
	' Uložiť; /ulozit; /save; null; null; null',
]

describe('POST /api/projects/:projectId/imports/preview', () => {
	it('matches columns, keys and values with the project and lists warnings', async () => {
		const app = createTestApp()
		const { project, sk, en, cs, cookie } = await setup(app)
		await createKey(project.id, 'loc', 'Uložiť', { [sk.id]: 'Uložiť', [en.id]: 'Save' })
		await createKey(project.id, 'loc', 'Zrušiť', { [sk.id]: 'Zrušiť', [en.id]: 'Cancel', [cs.id]: 'Zrušit' })
		await createKey(project.id, 'loc', 'Existujúci bez prekladov')
		await createKey(project.id, 'paths', 'orders', { [en.id]: '/orders' })
		await createKey(project.id, 'loc', 'Nie je v súbore', { [sk.id]: 'Nie je v súbore' })
		const other = await createProject()
		await createKey(other.id, 'loc', 'Máte {{ count }} položiek')

		expect(await previewOk(app, cookie, project.id, SAMPLE)).toEqual({
			columns: [
				{ tag: 'sk', columnIndex: 2, match: 'PROJECT', languageId: sk.id, stats: { translations: 5, untranslated: 1, warnings: 1 } },
				{ tag: 'EN', columnIndex: 3, match: 'PROJECT', languageId: en.id, stats: { translations: 5, untranslated: 1, warnings: 0 } },
				{ tag: 'cs', columnIndex: 4, match: 'PROJECT', languageId: cs.id, stats: { translations: 2, untranslated: 4, warnings: 1 } },
				{ tag: 'de-AT', columnIndex: 5, match: 'CATALOG', stats: { translations: 2, untranslated: 4, warnings: 0 } },
				{ tag: 'pl', columnIndex: 6, match: 'UNKNOWN', stats: { translations: 3, untranslated: 3, warnings: 1 } },
			],
			keys: { total: 6, new: 2, existing: 4 },
			namespaces: [
				{ namespace: 'loc', keys: 4 },
				{ namespace: 'paths', keys: 2 },
			],
			changes: [
				{ tag: 'sk', columnIndex: 2, new: 3, changed: 0, unchanged: 3, keptBecauseNull: 0 },
				{ tag: 'EN', columnIndex: 3, new: 2, changed: 1, unchanged: 3, keptBecauseNull: 0 },
				{ tag: 'cs', columnIndex: 4, new: 2, changed: 0, unchanged: 3, keptBecauseNull: 1 },
			],
			warnings: [
				{ code: 'LANGUAGE_NOT_IN_PROJECT', line: 1, column: 5, params: { tag: 'de-AT' } },
				{ code: 'LANGUAGE_UNKNOWN', line: 1, column: 6, params: { tag: 'pl' } },
				{
					code: 'PLACEHOLDER_MISMATCH',
					line: 5,
					column: 4,
					params: { tag: 'cs', key: 'Máte {{ count }} položiek', namespace: 'loc', missing: '{{count}}', extra: '{{total}}' },
				},
				{
					code: 'PLACEHOLDER_MISMATCH',
					line: 5,
					column: 6,
					params: { tag: 'pl', key: 'Máte {{ count }} položiek', namespace: 'loc', missing: '', extra: '{{x}}' },
				},
				{ code: 'BASE_LANGUAGE_UNTRANSLATED', line: 6, column: 2, params: { tag: 'sk', key: 'Existujúci bez prekladov', namespace: 'loc' } },
			],
			warningsTotal: 5,
		})
	})

	it('writes nothing', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app)
		await createKey(project.id, 'loc', 'Zrušiť', { [sk.id]: 'Zrušiť', [en.id]: 'Cancel' })
		const before = await countRows()
		const translationsBefore = await getTestPrisma().translation.findMany({ orderBy: { languageId: 'asc' } })

		await previewOk(app, cookie, project.id, SAMPLE)

		expect(await countRows()).toEqual(before)
		expect(await getTestPrisma().translation.findMany({ orderBy: { languageId: 'asc' } })).toEqual(translationsBefore)
	})

	it('compares placeholders without inner spaces, in both directions, and counts a repeated one as extra', async () => {
		const app = createTestApp()
		const { project, cookie } = await setup(app)

		const body = await previewOk(app, cookie, project.id, [
			'Keys; en ; sk ; cs',
			' a; {{count}} and {{ name }}; {{ count }} a {{name}}; {{name}} {{count}} {{count}}',
			' b; {{a}}; {{ a }} {{b}}; {{c}}',
			' c; no placeholders; {{x}}; null',
		])

		expect(body.warnings).toEqual([
			{ code: 'PLACEHOLDER_MISMATCH', line: 2, column: 4, params: { tag: 'cs', key: 'a', namespace: '', missing: '', extra: '{{count}}' } },
			{ code: 'PLACEHOLDER_MISMATCH', line: 3, column: 2, params: { tag: 'en', key: 'b', namespace: '', missing: '{{b}}', extra: '' } },
			{ code: 'PLACEHOLDER_MISMATCH', line: 3, column: 4, params: { tag: 'cs', key: 'b', namespace: '', missing: '{{a}}, {{b}}', extra: '{{c}}' } },
			{ code: 'PLACEHOLDER_MISMATCH', line: 4, column: 2, params: { tag: 'en', key: 'c', namespace: '', missing: '{{x}}', extra: '' } },
		])
	})

	it('treats i18next unescaped and formatted placeholders as the plain variable', async () => {
		const app = createTestApp()
		const { project, cookie } = await setup(app)

		const body = await previewOk(app, cookie, project.id, [
			'Keys; sk ; en ; cs',
			' a; {{count}} {{name}}; {{- name}} {{count, number}}; {{ count ,number(minimumFractionDigits: 2) }} {{-name}}',
			' b; {{count}}; {{- count, number}} {{amount, currency(EUR)}}; {{count}}',
		])

		expect(body.warnings).toEqual([
			{ code: 'PLACEHOLDER_MISMATCH', line: 3, column: 3, params: { tag: 'en', key: 'b', namespace: '', missing: '', extra: '{{amount}}' } },
		])
	})

	it('skips placeholder and base language warnings when the base language is not in the file', async () => {
		const app = createTestApp()
		const { project, cookie } = await setup(app)

		const body = await previewOk(app, cookie, project.id, ['Keys; en ; cs', ' a; {{count}}; null', ' b; null; {{x}}'])

		expect(body.warnings).toEqual([])
		expect(body.warningsTotal).toBe(0)
	})

	it(`lists at most ${IMPORT_WARNINGS_MAX} warnings with the full count`, async () => {
		const app = createTestApp()
		const { project, cookie } = await setup(app)
		const rows = Array.from({ length: IMPORT_WARNINGS_MAX + 100 }, (_, index) => ` key ${index}; null`)

		const body = await previewOk(app, cookie, project.id, ['Keys; sk', ...rows])

		expect(body.warnings).toHaveLength(IMPORT_WARNINGS_MAX)
		expect(body.warnings[0]).toMatchObject({ code: 'BASE_LANGUAGE_UNTRANSLATED', line: 2 })
		expect(body.warnings.at(-1)?.line).toBe(IMPORT_WARNINGS_MAX + 1)
		expect(body.warningsTotal).toBe(IMPORT_WARNINGS_MAX + 100)
		expect(body.columns[0]?.stats).toEqual({ translations: 0, untranslated: IMPORT_WARNINGS_MAX + 100, warnings: IMPORT_WARNINGS_MAX + 100 })
	})

	it.each<{ name: string; content: string; issues: ImportIssue[] }>([
		{ name: 'FILE_EMPTY', content: 'Keys; sk\n', issues: [{ code: 'FILE_EMPTY' }] },
		{ name: 'FILE_NOT_UTF8 (replacement character)', content: 'Keys; sk\n a; \uFFFD', issues: [{ code: 'FILE_NOT_UTF8', line: 2 }] },
		{ name: 'FILE_NOT_UTF8 (lone surrogate)', content: 'Keys; sk\n a; \uD800', issues: [{ code: 'FILE_NOT_UTF8', line: 2 }] },
		{ name: 'HEADER_INVALID', content: 'Key; sk\n a; b', issues: [{ code: 'HEADER_INVALID', line: 1, column: 1 }] },
		{ name: 'HEADER_EMPTY_TAG', content: 'Keys; sk ; \n a; b; c', issues: [{ code: 'HEADER_EMPTY_TAG', line: 1, column: 3 }] },
		{
			name: 'HEADER_DUPLICATE_TAG',
			content: 'Keys; sk ; SK\n a; b; c',
			issues: [{ code: 'HEADER_DUPLICATE_TAG', line: 1, column: 3, params: { tag: 'SK', firstColumn: 2 } }],
		},
		{
			name: 'ROW_COLUMN_COUNT',
			content: 'Keys; sk\n a; b; c',
			issues: [{ code: 'ROW_COLUMN_COUNT', line: 2, params: { expected: 2, actual: 3 } }],
		},
		{ name: 'ROW_EMPTY_KEY', content: 'Keys; sk\n ; b', issues: [{ code: 'ROW_EMPTY_KEY', line: 2, column: 1 }] },
		{
			name: 'ROW_DUPLICATE_KEY',
			content: 'Keys; sk\n--loc--\n a; b\n\n a; c',
			issues: [{ code: 'ROW_DUPLICATE_KEY', line: 5, column: 1, params: { key: 'a', namespace: 'loc', firstLine: 3 } }],
		},
		{
			name: 'KEY_TOO_LONG',
			content: `Keys; sk\n ${'k'.repeat(IMPORT_KEY_MAX_BYTES + 1)}; b`,
			issues: [{ code: 'KEY_TOO_LONG', line: 2, column: 1, params: { max: IMPORT_KEY_MAX_BYTES, length: IMPORT_KEY_MAX_BYTES + 1 } }],
		},
		{ name: 'NAMESPACE_INVALID', content: 'Keys; sk\n--a b--\n a; b', issues: [{ code: 'NAMESPACE_INVALID', line: 2, params: { namespace: 'a b' } }] },
	])('returns 422 IMPORT_FILE_INVALID with $name', async ({ content, issues }) => {
		const app = createTestApp()
		const { project, cookie } = await setup(app)

		expect(fileIssues(await preview(app, cookie, project.id, { fileName: 'a.csv', content }))).toEqual({ issues, total: issues.length })
	})

	it(`returns the first ${IMPORT_ISSUES_MAX} issues and their total`, async () => {
		const app = createTestApp()
		const { project, cookie } = await setup(app)
		const rows = Array.from({ length: 70 }, (_, index) => ` key ${index}; a; b`)

		const details = fileIssues(await previewCsv(app, cookie, project.id, ['Keys; sk', ...rows]))

		expect(details.issues).toHaveLength(IMPORT_ISSUES_MAX)
		expect(details.total).toBe(70)
	})

	it('returns 400 VALIDATION_ERROR for a missing content or a file name without .csv', async () => {
		const app = createTestApp()
		const { project, cookie } = await setup(app)

		const res = await preview(app, cookie, project.id, { fileName: 'translations.json' })

		expectErrorCode(res, 400, ERROR_CODE.VALIDATION_ERROR)
		const details = errorResponseSchema.parse(res.body).error.details
		expect(Array.isArray(details) ? details.map(({ path }) => path) : details).toEqual(['fileName', 'content'])
	})

	it('returns 413 IMPORT_FILE_TOO_LARGE for content over the limit in UTF-8 bytes', async () => {
		const app = createTestApp()
		const { project, cookie } = await setup(app)
		// Two bytes per character: under the limit in characters, over it in bytes, and under the 12 MB body limit.
		const content = 'é'.repeat(IMPORT_FILE_MAX_BYTES / 2 + 1)

		expectErrorCode(await preview(app, cookie, project.id, { fileName: 'a.csv', content }), 413, ERROR_CODE.IMPORT_FILE_TOO_LARGE)
	})

	it('returns 413 IMPORT_FILE_TOO_LARGE for a body over 12 MB', async () => {
		const app = createTestApp()
		const { project, cookie } = await setup(app)

		const res = await preview(app, cookie, project.id, { fileName: 'a.csv', content: 'x'.repeat(12 * 1024 * 1024 + 1) })

		expectErrorCode(res, 413, ERROR_CODE.IMPORT_FILE_TOO_LARGE)
	})

	it('accepts a 200 kB body while other routes keep the 100 kB limit', async () => {
		const app = createTestApp()
		const { project, cookie } = await setup(app)
		const rows = Array.from({ length: 4000 }, (_, index) => ` Kľúč číslo ${index}; Hodnota číslo ${index} s textom`)
		const content = ['Keys; sk', ...rows].join('\n')
		expect(Buffer.byteLength(content)).toBeGreaterThan(200 * 1024)

		const body = await previewOk(app, cookie, project.id, ['Keys; sk', ...rows])
		expect(body.keys.total).toBe(4000)

		const res = await request(app)
			.post('/api/projects')
			.set('Cookie', cookie)
			.set(CSRF_HEADERS)
			.send({ name: 'x'.repeat(200 * 1024), slug: 'x' })
		expectErrorCode(res, 413, ERROR_CODE.VALIDATION_ERROR)
	})

	describe('checks access before parsing the body', () => {
		// A small malformed body instead of an oversized one: the server answers before the client finishes
		// writing a multi-megabyte body, which resets the socket on the client side and makes the test flaky.
		// Parsing this body gives 400, so any other status proves the parser ran after the access check.
		const sendMalformed = (app: App, projectId: string, cookie?: string) => {
			const req = request(app).post(`/api/projects/${projectId}/imports/preview`).set(CSRF_HEADERS).set('Content-Type', 'application/json')
			return (cookie ? req.set('Cookie', cookie) : req).send('{"fileName": "a.csv", "content": ')
		}

		it('returns 400 for a member, so the parser does reject this body', async () => {
			const app = createTestApp()
			const { project, cookie } = await setup(app)

			expectErrorCode(await sendMalformed(app, project.id, cookie), 400, ERROR_CODE.VALIDATION_ERROR)
		})

		it('returns 401 without a session', async () => {
			const project = await createProject()

			expectErrorCode(await sendMalformed(createTestApp(), project.id), 401, ERROR_CODE.AUTH_UNAUTHENTICATED)
		})

		it('returns 404 for a non-member', async () => {
			const app = createTestApp()
			const { project, cookie } = await setup(app, ROLE.EDITOR, { member: false })

			expectErrorCode(await sendMalformed(app, project.id, cookie), 404, ERROR_CODE.NOT_FOUND)
		})
	})

	it('returns 401 without a session', async () => {
		const project = await createProject()

		const res = await request(createTestApp())
			.post(`/api/projects/${project.id}/imports/preview`)
			.set(CSRF_HEADERS)
			.send({ fileName: 'a.csv', content: '' })

		expectErrorCode(res, 401, ERROR_CODE.AUTH_UNAUTHENTICATED)
	})

	it('returns 403 CSRF_REJECTED without X-Requested-With', async () => {
		const app = createTestApp()
		const { project, cookie } = await setup(app)

		const res = await request(app)
			.post(`/api/projects/${project.id}/imports/preview`)
			.set('Cookie', cookie)
			.send({ fileName: 'a.csv', content: SAMPLE.join('\n') })

		expectErrorCode(res, 403, ERROR_CODE.CSRF_REJECTED)
	})

	it('returns 404 NOT_FOUND for a project of which the user is not a member, an unknown or an invalid id', async () => {
		const app = createTestApp()
		const { project, cookie } = await setup(app, ROLE.EDITOR, { member: false })
		const body = { fileName: 'a.csv', content: SAMPLE.join('\n') }

		expectErrorCode(await preview(app, cookie, project.id, body), 404, ERROR_CODE.NOT_FOUND)
		expectErrorCode(await preview(app, cookie, randomUUID(), body), 404, ERROR_CODE.NOT_FOUND)
		expectErrorCode(await preview(app, cookie, 'not-a-uuid', body), 404, ERROR_CODE.NOT_FOUND)
	})

	it('returns 403 FORBIDDEN to an EDITOR who is a member, also for a body over the JSON limit', async () => {
		const app = createTestApp()
		const { project, cookie } = await setup(app, ROLE.EDITOR)

		expectErrorCode(await preview(app, cookie, project.id, { fileName: 'a.csv', content: SAMPLE.join('\n') }), 403, ERROR_CODE.FORBIDDEN)
		expectErrorCode(await preview(app, cookie, project.id, { fileName: 'a.csv', content: 'x'.repeat(13 * 1024 * 1024) }), 403, ERROR_CODE.FORBIDDEN)
	})

	it('lets an ADMIN preview any project', async () => {
		const app = createTestApp()
		const { project, cookie } = await setup(app, ROLE.ADMIN, { member: false })

		expect((await previewOk(app, cookie, project.id, SAMPLE)).keys.total).toBe(6)
	})

	it('answers quickly for 2 500 keys in 9 languages', async () => {
		const app = createTestApp()
		const { project, cookie } = await setup(app)
		const prisma = getTestPrisma()
		const tags = ['sk', 'en', 'cs', 'bg', 'de-AT', 'hr', 'hu', 'ro', 'ru']
		for (const tag of tags.slice(3)) {
			await createLanguage(project.id, tag)
		}
		await prisma.$executeRaw`
			INSERT INTO "TranslationKey" (id, "projectId", namespace, name, "updatedAt")
			SELECT gen_random_uuid(), ${project.id}::uuid, 'loc', 'Veta číslo ' || i || ' {{count}}', now() FROM generate_series(1, 2500) AS i`
		await prisma.$executeRaw`
			INSERT INTO "Translation" ("keyId", "languageId", value, "updatedAt")
			SELECT k.id, l.id, l.tag || ' ' || k.name, now()
			FROM "TranslationKey" k CROSS JOIN "ProjectLanguage" l
			WHERE k."projectId" = ${project.id}::uuid AND l."projectId" = ${project.id}::uuid`
		const rows = Array.from({ length: 2500 }, (_, index) => {
			const key = `Veta číslo ${index + 1} {{count}}`
			return ` ${key}; ${tags.map((tag, column) => (column === 1 && index % 2 === 0 ? 'zmenené' : `${tag} ${key}`)).join('; ')}`
		})

		const started = performance.now()
		const body = await previewOk(app, cookie, project.id, [`Keys; ${tags.join(' ; ')}`, '--loc--', ...rows])
		const elapsed = performance.now() - started

		expect(body.keys).toEqual({ total: 2500, new: 0, existing: 2500 })
		expect(body.changes[1]).toMatchObject({ tag: 'en', changed: 1250, unchanged: 1250 })
		expect(body.warningsTotal).toBe(1250)
		expect(elapsed).toBeLessThan(1000)
	})
})

type ImportColumns = ImportRequestInput['columns']

const postImport = (app: App, cookie: string, projectId: string, body: object) =>
	request(app).post(`/api/projects/${projectId}/imports`).set('Cookie', cookie).set(CSRF_HEADERS).send(body)

const importCsv = (app: App, cookie: string, projectId: string, lines: string[], columns: ImportColumns, createMissingKeys?: boolean) =>
	postImport(app, cookie, projectId, { fileName: 'translations.csv', content: lines.join('\n'), columns, createMissingKeys })

const importOk = async (...args: Parameters<typeof importCsv>) => {
	const res = await importCsv(...args)
	expect(res.status).toBe(200)
	return importResultSchema.strict().parse(res.body)
}

/** Every translation of the project as `namespace/name tag = value`, sorted, with its author and time. */
const projectTranslations = async (projectId: string) => {
	const rows = await getTestPrisma().translation.findMany({
		where: { key: { projectId } },
		select: { value: true, updatedById: true, updatedAt: true, key: { select: { namespace: true, name: true } }, language: { select: { tag: true } } },
	})
	return rows
		.map(({ key, language, value, updatedById, updatedAt }) => ({ id: `${key.namespace}/${key.name} ${language.tag}`, value, updatedById, updatedAt }))
		.sort((a, b) => a.id.localeCompare(b.id))
}

const projectValues = async (projectId: string) => Object.fromEntries((await projectTranslations(projectId)).map(({ id, value }) => [id, value]))

const projectKeys = async (projectId: string) =>
	(await getTestPrisma().translationKey.findMany({ where: { projectId }, select: { namespace: true, name: true } }))
		.map(({ namespace, name }) => `${namespace}/${name}`)
		.sort()

describe('POST /api/projects/:projectId/imports', () => {
	const FILE = [
		'Keys; sk ; en ; cs',
		'--loc--',
		' Uložiť; Uložiť; Save; ""',
		' Zrušiť; Zrušiť; null; ',
		'--paths--',
		' orders; /objednavky; /orders; /objednavky',
	]

	const allColumns = (sk: { id: string }, en: { id: string }, cs: { id: string }): ImportColumns => [
		{ columnIndex: 2, languageId: sk.id },
		{ columnIndex: 3, languageId: en.id },
		{ columnIndex: 4, languageId: cs.id },
	]

	it('creates keys and filled translations in a new project, never null rows', async () => {
		const app = createTestApp()
		const { user, project, sk, en, cs, cookie } = await setup(app)

		expect(await importOk(app, cookie, project.id, FILE, allColumns(sk, en, cs))).toEqual({
			keysCreated: 3,
			translationsCreated: 6,
			translationsUpdated: 0,
			skippedColumns: 0,
		})

		expect(await projectKeys(project.id)).toEqual(['loc/Uložiť', 'loc/Zrušiť', 'paths/orders'])
		const translations = await projectTranslations(project.id)
		expect(Object.fromEntries(translations.map(({ id, value }) => [id, value]))).toEqual({
			'loc/Uložiť en': 'Save',
			'loc/Uložiť sk': 'Uložiť',
			'loc/Zrušiť sk': 'Zrušiť',
			'paths/orders cs': '/objednavky',
			'paths/orders en': '/orders',
			'paths/orders sk': '/objednavky',
		})
		expect(translations.every(({ updatedById }) => updatedById === user.id)).toBe(true)
	})

	it('makes a key plural when its values are plural messages with one variable, never changing an existing variable', async () => {
		const app = createTestApp()
		const { project, sk, en, cs, cookie } = await setup(app)
		const prisma = getTestPrisma()
		await createKey(project.id, 'loc', 'existing', { [sk.id]: '{count, plural, one {# kus} other {# kusov}}' })
		await prisma.translationKey.create({ data: { projectId: project.id, namespace: 'loc', name: 'kept', pluralVariable: 'n' } })

		await importOk(
			app,
			cookie,
			project.id,
			[
				'Keys; sk ; en ; cs',
				'--loc--',
				'items; {count, plural, one {# položka} few {# položky} other {# položiek}}; {count, plural, one {# item} other {# items}}; ',
				'mixed; {count, plural, one {# kus} other {# kusov}}; {n, plural, one {# piece} other {# pieces}}; ',
				'plain; Položky; Items; ',
				'existing; ; {count, plural, one {# piece} other {# pieces}}; ',
				'kept; ; {count, plural, one {# piece} other {# pieces}}; ',
			],
			allColumns(sk, en, cs),
		)

		const keys = await prisma.translationKey.findMany({ where: { projectId: project.id }, select: { name: true, pluralVariable: true } })
		expect(Object.fromEntries(keys.map(({ name, pluralVariable }) => [name, pluralVariable]))).toEqual({
			items: 'count',
			mixed: null,
			plain: null,
			existing: 'count',
			kept: 'n',
		})
	})

	it('detects a plural from the stored values and writes a plural wrapped in text as a plain plural message, counted like the preview', async () => {
		const app = createTestApp()
		const { project, sk, en, cs, cookie } = await setup(app)
		await createKey(project.id, 'loc', 'stored', { [sk.id]: '{count, plural, one {{count} osoba} other {{count} osôb}}', [en.id]: 'undefined' })
		const file = [
			'Keys; sk ; en ; cs',
			'--loc--',
			'stars; {category}, {starCount, plural, one {# hviezdička} other {# hviezdičiek}}; undefined; ',
			'stored; ; undefined; ',
		]
		const changes = (await previewOk(app, cookie, project.id, file)).changes.map(({ tag, new: added, changed, unchanged }) => ({
			tag,
			added,
			changed,
			unchanged,
		}))

		await importOk(app, cookie, project.id, file, allColumns(sk, en, cs))
		const second = (await previewOk(app, cookie, project.id, file)).changes

		const keys = await getTestPrisma().translationKey.findMany({ where: { projectId: project.id }, select: { name: true, pluralVariable: true } })
		expect(Object.fromEntries(keys.map(({ name, pluralVariable }) => [name, pluralVariable]))).toEqual({ stars: 'starCount', stored: 'count' })
		expect(await projectValues(project.id)).toMatchObject({
			'loc/stars sk': '{starCount, plural, one {{category}, # hviezdička} other {{category}, # hviezdičiek}}',
			'loc/stars en': 'undefined',
		})
		expect(changes).toEqual([
			{ tag: 'sk', added: 1, changed: 0, unchanged: 0 },
			{ tag: 'en', added: 1, changed: 0, unchanged: 1 },
			{ tag: 'cs', added: 0, changed: 0, unchanged: 2 },
		])
		// Re-importing the same file finds the stored plain plural message equal, so nothing changes.
		expect(second.every((column) => column.new === 0 && column.changed === 0)).toBe(true)
	})

	it('changes nothing when the same file is imported again', async () => {
		const app = createTestApp()
		const { project, sk, en, cs, cookie } = await setup(app)
		await importOk(app, cookie, project.id, FILE, allColumns(sk, en, cs))
		const before = await projectTranslations(project.id)

		expect(await importOk(app, cookie, project.id, FILE, allColumns(sk, en, cs))).toEqual({
			keysCreated: 0,
			translationsCreated: 0,
			translationsUpdated: 0,
			skippedColumns: 0,
		})
		expect(await projectTranslations(project.id)).toEqual(before)
	})

	it('overwrites a different value, fills an empty one, keeps a value the file has as null and leaves equal values untouched', async () => {
		const app = createTestApp()
		const { user, project, sk, en, cs, cookie } = await setup(app)
		await createKey(project.id, 'loc', 'Uložiť', { [sk.id]: 'Uložiť', [en.id]: 'Store', [cs.id]: 'Uložit' })
		await createKey(project.id, 'loc', 'Zrušiť', { [sk.id]: null, [en.id]: 'Cancel' })
		await createKey(project.id, 'loc', 'Nie je v súbore', { [sk.id]: 'Nie je v súbore' })
		const before = new Map((await projectTranslations(project.id)).map((row) => [row.id, row]))

		expect(await importOk(app, cookie, project.id, FILE.slice(0, 4), allColumns(sk, en, cs))).toEqual({
			keysCreated: 0,
			translationsCreated: 1,
			translationsUpdated: 1,
			skippedColumns: 0,
		})

		const after = await projectTranslations(project.id)
		expect(Object.fromEntries(after.map(({ id, value }) => [id, value]))).toEqual({
			'loc/Nie je v súbore sk': 'Nie je v súbore',
			'loc/Uložiť cs': 'Uložit',
			'loc/Uložiť en': 'Save',
			'loc/Uložiť sk': 'Uložiť',
			'loc/Zrušiť en': 'Cancel',
			'loc/Zrušiť sk': 'Zrušiť',
		})
		for (const row of after) {
			if (row.id === 'loc/Uložiť en' || row.id === 'loc/Zrušiť sk') {
				expect(row.updatedById).toBe(user.id)
				expect(row.updatedAt.getTime()).toBeGreaterThan(before.get(row.id)?.updatedAt.getTime() ?? Infinity)
			} else {
				expect(row).toEqual(before.get(row.id))
			}
		}
	})

	it('writes nothing for a skipped column', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app)

		const result = await importOk(app, cookie, project.id, FILE, [
			{ columnIndex: 2, languageId: sk.id },
			{ columnIndex: 3, languageId: en.id },
			{ columnIndex: 4, languageId: null },
		])

		expect(result).toEqual({ keysCreated: 3, translationsCreated: 5, translationsUpdated: 0, skippedColumns: 1 })
		expect(Object.keys(await projectValues(project.id)).filter((id) => id.endsWith(' cs'))).toEqual([])
	})

	it('imports only values of existing keys when createMissingKeys is false', async () => {
		const app = createTestApp()
		const { project, sk, en, cs, cookie } = await setup(app)
		await createKey(project.id, 'loc', 'Uložiť')

		expect(await importOk(app, cookie, project.id, FILE, allColumns(sk, en, cs), false)).toEqual({
			keysCreated: 0,
			translationsCreated: 2,
			translationsUpdated: 0,
			skippedColumns: 0,
		})
		expect(await projectKeys(project.id)).toEqual(['loc/Uložiť'])
		expect(await projectValues(project.id)).toEqual({ 'loc/Uložiť en': 'Save', 'loc/Uložiť sk': 'Uložiť' })
	})

	it('creates missing keys when createMissingKeys is left out', async () => {
		const app = createTestApp()
		const { project, sk, cookie } = await setup(app)

		const res = await postImport(app, cookie, project.id, {
			fileName: 'a.csv',
			content: 'Keys; sk\n a; A',
			columns: [{ columnIndex: 2, languageId: sk.id }],
		})

		expect(res.status).toBe(200)
		expect(await projectValues(project.id)).toEqual({ '/a sk': 'A' })
	})

	it('maps an unknown and a catalog column onto project languages regardless of their tags', async () => {
		const app = createTestApp()
		const { project, sk, en, cs, cookie } = await setup(app)

		const result = await importOk(
			app,
			cookie,
			project.id,
			['Keys; sk ; pl ; de-AT', ' a; A; Polski; Deutsch'],
			[
				{ columnIndex: 2, languageId: sk.id },
				{ columnIndex: 3, languageId: cs.id },
				{ columnIndex: 4, languageId: en.id },
			],
		)

		expect(result).toEqual({ keysCreated: 1, translationsCreated: 3, translationsUpdated: 0, skippedColumns: 0 })
		expect(await projectValues(project.id)).toEqual({ '/a cs': 'Polski', '/a en': 'Deutsch', '/a sk': 'A' })
	})

	it('returns the counts of the preview for the same file and mapping', async () => {
		const app = createTestApp()
		const { project, sk, en, cs, cookie } = await setup(app)
		await createKey(project.id, 'loc', 'Uložiť', { [sk.id]: 'Uložiť', [en.id]: 'Save' })
		await createKey(project.id, 'loc', 'Zrušiť', { [sk.id]: 'Zrušiť', [en.id]: 'Cancel', [cs.id]: 'Zrušit' })
		await createKey(project.id, 'loc', 'Existujúci bez prekladov')
		await createKey(project.id, 'paths', 'orders', { [en.id]: '/orders', [cs.id]: null })
		const body = await previewOk(app, cookie, project.id, SAMPLE)

		const result = await importOk(
			app,
			cookie,
			project.id,
			SAMPLE,
			body.columns.map(({ columnIndex, languageId }) => ({ columnIndex, languageId: languageId ?? null })),
		)

		expect(result).toEqual({
			keysCreated: body.keys.new,
			translationsCreated: body.changes.reduce((sum, change) => sum + change.new, 0),
			translationsUpdated: body.changes.reduce((sum, change) => sum + change.changed, 0),
			skippedColumns: 2,
		})
		expect(result.translationsCreated).toBeGreaterThan(0)
		expect(result.translationsUpdated).toBeGreaterThan(0)
	})

	it('serializes concurrent imports of one project with the same outcome as running them one after the other', async () => {
		const app = createTestApp()
		const { project, en, cookie } = await setup(app)
		const columns = [{ columnIndex: 2, languageId: en.id }]
		const first = ['Keys; en', ...Array.from({ length: 2000 }, (_, index) => ` key ${index}; first ${index}`)]
		const second = ['Keys; en', ...Array.from({ length: 2000 }, (_, index) => ` key ${index + 1000}; second ${index + 1000}`)]

		const results = await Promise.all([importOk(app, cookie, project.id, first, columns), importOk(app, cookie, project.id, second, columns)])

		const firstWonOrder = results[0].keysCreated === 2000
		const [earlier, later] = firstWonOrder ? results : [results[1], results[0]]
		expect(earlier).toEqual({ keysCreated: 2000, translationsCreated: 2000, translationsUpdated: 0, skippedColumns: 0 })
		expect(later).toEqual({ keysCreated: 1000, translationsCreated: 1000, translationsUpdated: 1000, skippedColumns: 0 })
		const values = await projectValues(project.id)
		expect(Object.keys(values)).toHaveLength(3000)
		expect(values['/key 1500 en']).toBe(firstWonOrder ? 'second 1500' : 'first 1500')
		expect(values['/key 500 en']).toBe('first 500')
		expect(values['/key 2500 en']).toBe('second 2500')
	})

	it('waits for the project import lock and reads the project only after it gets it', async () => {
		const app = createTestApp()
		const { project, en, cookie } = await setup(app)
		const prisma = getTestPrisma()
		let release = () => {}
		const released = new Promise<void>((resolve) => {
			release = resolve
		})
		let lockTaken = () => {}
		const locked = new Promise<void>((resolve) => {
			lockTaken = resolve
		})
		// Holds the import lock and, like an earlier import, creates a key the waiting import must see as existing.
		const holder = prisma.$transaction(
			async (tx) => {
				await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`import:${project.id}`}, 0))`
				await tx.translationKey.create({ data: { projectId: project.id, name: 'a', translations: { create: { languageId: en.id, value: 'held' } } } })
				lockTaken()
				await released
			},
			{ timeout: 20_000 },
		)
		await locked

		let settled = false
		const pending = importOk(app, cookie, project.id, ['Keys; en', ' a; imported', ' b; B'], [{ columnIndex: 2, languageId: en.id }]).finally(() => {
			settled = true
		})
		await vi.waitFor(async () => {
			const [{ waiting }] = await prisma.$queryRaw<
				[{ waiting: number }]
			>`SELECT count(*)::int AS waiting FROM pg_locks WHERE locktype = 'advisory' AND NOT granted`
			expect(waiting).toBe(1)
		})

		expect(settled).toBe(false)
		expect(await countRows()).toMatchObject({ keys: 0, translations: 0 })

		release()
		await holder
		expect(await pending).toEqual({ keysCreated: 1, translationsCreated: 1, translationsUpdated: 1, skippedColumns: 0 })
		expect(await projectValues(project.id)).toEqual({ '/a en': 'imported', '/b en': 'B' })
	})

	describe('returns 400 IMPORT_COLUMNS_INVALID and writes nothing', () => {
		it.each<{ name: string; columns: (ids: { sk: string; en: string; cs: string; foreign: string }) => ImportColumns }>([
			{
				name: 'a column that is not a language column of the file',
				columns: ({ sk, en, cs }) => [
					{ columnIndex: 2, languageId: sk },
					{ columnIndex: 3, languageId: en },
					{ columnIndex: 4, languageId: cs },
					{ columnIndex: 5, languageId: null },
				],
			},
			{
				name: 'a missing language column',
				columns: ({ sk, en }) => [
					{ columnIndex: 2, languageId: sk },
					{ columnIndex: 3, languageId: en },
				],
			},
			{
				name: 'a column listed twice',
				columns: ({ sk, en }) => [
					{ columnIndex: 2, languageId: sk },
					{ columnIndex: 3, languageId: en },
					{ columnIndex: 4, languageId: null },
					{ columnIndex: 4, languageId: null },
				],
			},
			{
				name: 'a language of another project',
				columns: ({ sk, en, foreign }) => [
					{ columnIndex: 2, languageId: sk },
					{ columnIndex: 3, languageId: en },
					{ columnIndex: 4, languageId: foreign },
				],
			},
			{
				name: 'an unknown language id',
				columns: ({ sk, en }) => [
					{ columnIndex: 2, languageId: sk },
					{ columnIndex: 3, languageId: en },
					{ columnIndex: 4, languageId: randomUUID() },
				],
			},
			{
				name: 'the same language mapped twice',
				columns: ({ sk, en }) => [
					{ columnIndex: 2, languageId: sk },
					{ columnIndex: 3, languageId: en },
					{ columnIndex: 4, languageId: en },
				],
			},
			{
				name: 'every column skipped',
				columns: () => [
					{ columnIndex: 2, languageId: null },
					{ columnIndex: 3, languageId: null },
					{ columnIndex: 4, languageId: null },
				],
			},
		])('for $name', async ({ columns }) => {
			const app = createTestApp()
			const { project, sk, en, cs, cookie } = await setup(app)
			const other = await createProject()
			const foreign = await createLanguage(other.id, 'cs')

			const res = await importCsv(app, cookie, project.id, FILE, columns({ sk: sk.id, en: en.id, cs: cs.id, foreign: foreign.id }))

			expectErrorCode(res, 400, ERROR_CODE.IMPORT_COLUMNS_INVALID)
			expect(await countRows()).toEqual({ keys: 0, translations: 0, languages: 4 })
		})
	})

	it('returns 400 VALIDATION_ERROR without columns', async () => {
		const app = createTestApp()
		const { project, cookie } = await setup(app)

		const res = await postImport(app, cookie, project.id, { fileName: 'a.csv', content: FILE.join('\n'), columns: [] })

		expectErrorCode(res, 400, ERROR_CODE.VALIDATION_ERROR)
	})

	it('returns 422 IMPORT_FILE_INVALID like the preview and writes nothing', async () => {
		const app = createTestApp()
		const { project, sk, cookie } = await setup(app)

		const res = await importCsv(app, cookie, project.id, ['Keys; sk', ' a; b; c'], [{ columnIndex: 2, languageId: sk.id }])

		expect(fileIssues(res)).toEqual({ issues: [{ code: 'ROW_COLUMN_COUNT', line: 2, params: { expected: 2, actual: 3 } }], total: 1 })
		expect((await countRows()).keys).toBe(0)
	})

	it('returns 413 IMPORT_FILE_TOO_LARGE for content over the limit in UTF-8 bytes', async () => {
		const app = createTestApp()
		const { project, sk, cookie } = await setup(app)
		const content = 'é'.repeat(IMPORT_FILE_MAX_BYTES / 2 + 1)

		const res = await postImport(app, cookie, project.id, { fileName: 'a.csv', content, columns: [{ columnIndex: 2, languageId: sk.id }] })

		expectErrorCode(res, 413, ERROR_CODE.IMPORT_FILE_TOO_LARGE)
	})

	it('returns 401 without a session', async () => {
		const project = await createProject()

		const res = await request(createTestApp())
			.post(`/api/projects/${project.id}/imports`)
			.set(CSRF_HEADERS)
			.send({ fileName: 'a.csv', content: FILE.join('\n'), columns: [] })

		expectErrorCode(res, 401, ERROR_CODE.AUTH_UNAUTHENTICATED)
	})

	it('returns 404 NOT_FOUND for a project of which the user is not a member or an unknown project', async () => {
		const app = createTestApp()
		const { project, sk, en, cs, cookie } = await setup(app, ROLE.EDITOR, { member: false })

		expectErrorCode(await importCsv(app, cookie, project.id, FILE, allColumns(sk, en, cs)), 404, ERROR_CODE.NOT_FOUND)
		expectErrorCode(await importCsv(app, cookie, randomUUID(), FILE, allColumns(sk, en, cs)), 404, ERROR_CODE.NOT_FOUND)
		expect((await countRows()).keys).toBe(0)
	})

	it('returns 403 FORBIDDEN to an EDITOR who is a member and writes nothing', async () => {
		const app = createTestApp()
		const { project, sk, en, cs, cookie } = await setup(app, ROLE.EDITOR)

		expectErrorCode(await importCsv(app, cookie, project.id, FILE, allColumns(sk, en, cs)), 403, ERROR_CODE.FORBIDDEN)
		expect((await countRows()).keys).toBe(0)
	})

	it('lets an ADMIN import into any project', async () => {
		const app = createTestApp()
		const { project, sk, en, cs, cookie } = await setup(app, ROLE.ADMIN, { member: false })

		expect((await importOk(app, cookie, project.id, FILE, allColumns(sk, en, cs))).keysCreated).toBe(3)
	})

	it('imports 2 500 keys in 10 languages in under 5 s', async () => {
		const app = createTestApp()
		const { project, sk, en, cs, cookie } = await setup(app)
		const extra = []
		for (const tag of ['bg', 'de-AT', 'hr', 'hu', 'ro', 'ru', 'pl']) {
			extra.push(await createLanguage(project.id, tag))
		}
		const languages = [sk, en, cs, ...extra]
		const rows = Array.from({ length: 2500 }, (_, index) => {
			const key = `Veta číslo ${index + 1} s textom {{count}}`
			return ` ${key}; ${languages.map(({ tag }) => `${tag} ${key}`).join('; ')}`
		})
		const lines = [`Keys; ${languages.map(({ tag }) => tag).join(' ; ')}`, '--loc--', ...rows]
		const columns = languages.map(({ id }, index) => ({ columnIndex: index + 2, languageId: id }))

		const started = performance.now()
		const result = await importOk(app, cookie, project.id, lines, columns)
		const elapsed = performance.now() - started

		expect(result).toEqual({ keysCreated: 2500, translationsCreated: 25000, translationsUpdated: 0, skippedColumns: 0 })
		expect(await getTestPrisma().translation.count()).toBe(25000)
		expect(elapsed, `import took ${Math.round(elapsed)} ms`).toBeLessThan(5000)
	})
})

describe('TranslationKey', () => {
	const cyrillicKey = (length: number) => {
		const alphabet = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя'
		let seed = 7
		return Array.from({ length }, () => {
			seed = (seed * 48271) % 2147483647
			return alphabet[seed % alphabet.length]
		}).join('')
	}

	it(`stores a Cyrillic key of ${IMPORT_KEY_MAX_BYTES} bytes with a ${IMPORT_NAMESPACE_MAX_LENGTH}-character namespace under the unique index`, async () => {
		const project = await createProject()
		const name = cyrillicKey(IMPORT_KEY_MAX_BYTES / 2)
		const namespace = 'n'.repeat(IMPORT_NAMESPACE_MAX_LENGTH)
		expect(Buffer.byteLength(name)).toBe(IMPORT_KEY_MAX_BYTES)

		await createKey(project.id, namespace, name)

		expect(await getTestPrisma().translationKey.count({ where: { name } })).toBe(1)
	})

	it('rejects 2 000 Cyrillic characters in the preview as KEY_TOO_LONG', async () => {
		const app = createTestApp()
		const { project, cookie } = await setup(app)
		const name = cyrillicKey(2000)

		expect(fileIssues(await previewCsv(app, cookie, project.id, ['Keys; sk', ` ${name}; a`]))).toEqual({
			issues: [{ code: 'KEY_TOO_LONG', line: 2, column: 1, params: { max: IMPORT_KEY_MAX_BYTES, length: Buffer.byteLength(name) } }],
			total: 1,
		})
	})
})
