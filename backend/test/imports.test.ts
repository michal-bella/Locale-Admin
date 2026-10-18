import { randomUUID } from 'node:crypto'

import request from 'supertest'
import { describe, expect, it } from 'vitest'

import {
	ERROR_CODE,
	IMPORT_FILE_MAX_BYTES,
	IMPORT_ISSUES_MAX,
	IMPORT_KEY_MAX_LENGTH,
	IMPORT_WARNINGS_MAX,
	ROLE,
	errorResponseSchema,
	importFileInvalidDetailsSchema,
	importPreviewResponseSchema,
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

/** Logs in a new user who is a member of a new project with `sk` (base), `en` and `cs`. */
const setup = async (app: App, role: ROLE = ROLE.EDITOR, { member = true }: { member?: boolean } = {}) => {
	const { user } = await createUser({ role })
	const project = await createProject(member ? [user.id] : [])
	const sk = await createLanguage(project.id, 'sk', true)
	const en = await createLanguage(project.id, 'en')
	const cs = await createLanguage(project.id, 'cs')
	return { project, sk, en, cs, cookie: await loginAs(app, { email: user.email, password: TEST_PASSWORD }) }
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

	it('compares placeholders as sets without inner spaces, in both directions', async () => {
		const app = createTestApp()
		const { project, cookie } = await setup(app)

		const body = await previewOk(app, cookie, project.id, [
			'Keys; en ; sk ; cs',
			' a; {{count}} and {{ name }}; {{ count }} a {{name}}; {{name}} {{count}} {{count}}',
			' b; {{a}}; {{ a }} {{b}}; {{c}}',
			' c; no placeholders; {{x}}; null',
		])

		expect(body.warnings).toEqual([
			{ code: 'PLACEHOLDER_MISMATCH', line: 3, column: 2, params: { tag: 'en', key: 'b', namespace: '', missing: '{{b}}', extra: '' } },
			{ code: 'PLACEHOLDER_MISMATCH', line: 3, column: 4, params: { tag: 'cs', key: 'b', namespace: '', missing: '{{a}}, {{b}}', extra: '{{c}}' } },
			{ code: 'PLACEHOLDER_MISMATCH', line: 4, column: 2, params: { tag: 'en', key: 'c', namespace: '', missing: '{{x}}', extra: '' } },
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
			content: `Keys; sk\n ${'k'.repeat(IMPORT_KEY_MAX_LENGTH + 1)}; b`,
			issues: [{ code: 'KEY_TOO_LONG', line: 2, column: 1, params: { max: IMPORT_KEY_MAX_LENGTH, length: IMPORT_KEY_MAX_LENGTH + 1 } }],
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

describe('TranslationKey', () => {
	// Fails today: the btree index on (projectId, namespace, name) allows 2 704 bytes per row. TODO: decide a fix before the import writes keys (milestone C).
	it.fails(`stores a ${IMPORT_KEY_MAX_LENGTH}-character Cyrillic key under the unique index`, async () => {
		const project = await createProject()
		const alphabet = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя'
		let seed = 7
		const name = Array.from({ length: IMPORT_KEY_MAX_LENGTH }, () => {
			seed = (seed * 48271) % 2147483647
			return alphabet[seed % alphabet.length]
		}).join('')
		expect(Buffer.byteLength(name)).toBeGreaterThan(3000)

		await createKey(project.id, 'loc', name)

		expect(await getTestPrisma().translationKey.count({ where: { name } })).toBe(1)
	})
})
