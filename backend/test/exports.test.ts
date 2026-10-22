import { randomUUID } from 'node:crypto'
import { request as httpRequest } from 'node:http'
import { type AddressInfo } from 'node:net'

import ExcelJS from 'exceljs'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'

import {
	ERROR_CODE,
	EXPORT_ISSUES_MAX,
	ROLE,
	errorResponseSchema,
	exportCheckResponseSchema,
	exportValueUnsafeDetailsSchema,
	importResultSchema,
} from '@locale/shared'

import { EXPORT_BATCH_SIZE } from '../src/services/exports.service'

import { createTestApp } from './helpers/app'
import { CSRF_HEADERS, loginAs } from './helpers/auth'
import { getTestPrisma } from './helpers/db'
import { TEST_PASSWORD, createUser } from './helpers/users'
import { createVersionRow, versionIdOf } from './helpers/versions'

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
const createKey = async (projectId: string, namespace: string, name: string, values: Record<string, string | null> = {}) =>
	getTestPrisma().translationKey.create({
		data: {
			projectId,
			versionId: await versionIdOf(projectId),
			namespace,
			name,
			translations: { create: Object.entries(values).map(([languageId, value]) => ({ languageId, value })) },
		},
	})

/** A member of a new project with `sk` (base), then `en` and `cs` in the order of their position. */
const setup = async (app: App, { member = true, role = ROLE.EDITOR }: { member?: boolean; role?: ROLE } = {}) => {
	const { user } = await createUser({ role })
	const project = await createProject(member ? [user.id] : [])
	await createVersionRow(project.id)
	const cs = await createLanguage(project.id, 'cs', { position: 2 })
	const sk = await createLanguage(project.id, 'sk', { isBase: true, position: 1 })
	const en = await createLanguage(project.id, 'en', { position: 0 })
	return { project, sk, en, cs, cookie: await loginAs(app, { email: user.email, password: TEST_PASSWORD }) }
}

const exportCsv = async (app: App, cookie: string, projectId: string, query: Record<string, string>) =>
	request(app)
		.get(`/api/projects/${projectId}/export`)
		.query({ versionId: await versionIdOf(projectId), ...query })
		.set('Cookie', cookie)

/** Makes the next export wait inside its transaction call, holding its slot, until `release()`. */
const blockNextExport = () => {
	const prisma = getTestPrisma()
	const transaction = prisma.$transaction.bind(prisma)
	let entered = () => {}
	const started = new Promise<void>((resolve) => {
		entered = resolve
	})
	let release = () => {}
	const released = new Promise<void>((resolve) => {
		release = resolve
	})
	const spy = vi.spyOn(prisma, '$transaction').mockImplementationOnce(async (...args: Parameters<typeof transaction>) => {
		entered()
		await released
		return transaction(...args)
	})
	return { started, release, restore: () => spy.mockRestore() }
}

/** Downloads the XLSX and reads it back: the rows of the only sheet as arrays of cell values (`null` for an empty cell). */
const exportXlsx = async (app: App, cookie: string, projectId: string, query: Record<string, string>) => {
	const res = await request(app)
		.get(`/api/projects/${projectId}/export`)
		.query({ versionId: await versionIdOf(projectId), ...query, format: 'XLSX' })
		.set('Cookie', cookie)
		.buffer(true)
		.parse((response, callback) => {
			const chunks: Buffer[] = []
			response.on('data', (chunk: Buffer) => chunks.push(chunk))
			response.on('end', () => callback(null, Buffer.concat(chunks)))
		})
	expect(res.status).toBe(200)
	const workbook = new ExcelJS.Workbook()
	const body = res.body as Buffer
	await workbook.xlsx.load(body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer)
	expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['Translations'])
	const sheet = workbook.worksheets[0]!
	const rows: (string | null)[][] = []
	sheet.eachRow({ includeEmpty: true }, (row) => {
		rows.push(Array.from({ length: sheet.columnCount }, (_, index) => (row.getCell(index + 1).value as string | null) ?? null))
	})
	return { res, sheet, rows }
}

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
		const versionId = await versionIdOf(project.id)
		await getTestPrisma().translationKey.createMany({
			data: names.map((name, index) => ({ projectId: project.id, versionId, namespace: index % 2 === 0 ? 'a' : 'b', name })),
		})

		const lines = (await exportOk(app, cookie, project.id, { languageIds: sk.id })).trimEnd().split('\n')

		const expected = (namespace: string, parity: number) => names.filter((_, index) => index % 2 === parity).map((name) => ` ${name}; null`)
		expect(lines).toEqual(['Keys; sk ', '--a--', ...expected('a', 0), '--b--', ...expected('b', 1)])
	})

	it('gives back the imported file byte for byte', async () => {
		const app = createTestApp()
		const { project, sk, en, cs, cookie } = await setup(app, { role: ROLE.ADMIN })
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
			.send({ versionId: await versionIdOf(project.id), fileName: 'translations.csv', content: file, columns })
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
		const versionId = await versionIdOf(project.id)
		await getTestPrisma().translationKey.createMany({
			data: Array.from({ length: EXPORT_ISSUES_MAX }, (_, index) => ({ projectId: project.id, versionId, namespace: 'loc', name: `k;${index}` })),
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

	it('filters by status in every batch, also when a batch has no matching key', async () => {
		const app = createTestApp()
		const { project, sk, cookie } = await setup(app)
		const count = EXPORT_BATCH_SIZE * 2 + 3
		const names = Array.from({ length: count }, (_, index) => `key.${String(index).padStart(5, '0')}`)
		const versionId = await versionIdOf(project.id)
		await getTestPrisma().translationKey.createMany({ data: names.map((name) => ({ projectId: project.id, versionId, namespace: 'a', name })) })
		// Translated: every key of the first batch and every third key after it.
		const translated = names.filter((_, index) => index < EXPORT_BATCH_SIZE || index % 3 === 0)
		const keys = await getTestPrisma().translationKey.findMany({ where: { projectId: project.id, name: { in: translated } }, select: { id: true } })
		await getTestPrisma().translation.createMany({ data: keys.map((key) => ({ keyId: key.id, languageId: sk.id, value: 'V' })) })

		const lines = (status: string) => exportOk(app, cookie, project.id, { languageIds: sk.id, status }).then((text) => text.trimEnd().split('\n').slice(2))

		expect(await lines('TRANSLATED')).toEqual(translated.map((name) => ` ${name}; V`))
		expect(await lines('UNTRANSLATED')).toEqual(names.filter((name) => !translated.includes(name)).map((name) => ` ${name}; null`))
	})

	it('refuses a namespace that the converter would read back differently, once per namespace', async () => {
		const app = createTestApp()
		const { project, sk, cookie } = await setup(app)
		const first = await createKey(project.id, 'a--b', 'first', { [sk.id]: 'A' })
		await createKey(project.id, 'a--b', 'second', { [sk.id]: 'B' })
		await createKey(project.id, 'loc', 'ok', { [sk.id]: 'C' })

		const res = await exportCsv(app, cookie, project.id, { languageIds: sk.id })

		expectErrorCode(res, 422, ERROR_CODE.EXPORT_VALUE_UNSAFE)
		expect(errorResponseSchema.parse(res.body).error.details).toEqual({
			issues: [{ code: 'NAMESPACE', keyId: first.id, namespace: 'a--b', key: 'first', languageTag: null }],
			total: 1,
		})
	})

	it('lets a global ADMIN export a project they are not a member of', async () => {
		const app = createTestApp()
		const { user } = await createUser({ role: ROLE.ADMIN })
		const project = await createProject()
		const sk = await createLanguage(project.id, 'sk', { isBase: true })
		await createKey(project.id, 'loc', 'a', { [sk.id]: 'A' })
		const cookie = await loginAs(app, { email: user.email, password: TEST_PASSWORD })

		expect(await exportOk(app, cookie, project.id, { languageIds: sk.id })).toBe('Keys; sk \n--loc--\n a; A\n')
	})

	describe('XLSX', () => {
		it('writes one sheet with Namespace, Key and the languages in the project order, empty cells for untranslated', async () => {
			const app = createTestApp()
			const { project, sk, en, cs, cookie } = await setup(app)
			await createKey(project.id, 'paths', 'orders', { [en.id]: '/orders' })
			await createKey(project.id, 'loc', 'Áno', { [sk.id]: 'Áno', [en.id]: 'Yes', [cs.id]: 'Ano' })
			await createKey(project.id, '', 'title', { [sk.id]: 'Titulok' })

			const { res, sheet, rows } = await exportXlsx(app, cookie, project.id, { languageIds: [cs.id, en.id, sk.id].join(',') })

			expect(res.headers['content-type']).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
			expect(res.headers['content-disposition']).toBe('attachment; filename="translations.xlsx"')
			expect(rows).toEqual([
				['Namespace', 'Key', 'sk', 'en', 'cs'],
				[null, 'title', 'Titulok', null, null],
				['loc', 'Áno', 'Áno', 'Yes', 'Ano'],
				['paths', 'orders', null, '/orders', null],
			])
			expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 })
			expect(sheet.getRow(1).font).toMatchObject({ bold: true })
		})

		it('keeps values that would break the CSV and drops characters XML does not allow', async () => {
			const app = createTestApp()
			const { project, sk, cookie } = await setup(app)
			await createKey(project.id, 'a--b', 'Ahoj;svet', { [sk.id]: 'riadok 1\nriadok 2; Od --9-- do\u0007' })

			const { rows } = await exportXlsx(app, cookie, project.id, { languageIds: sk.id })

			expect(rows[1]).toEqual(['a--b', 'Ahoj;svet', 'riadok 1\nriadok 2; Od --9-- do'])
		})

		it('filters by status and writes every key across batches', async () => {
			const app = createTestApp()
			const { project, sk, cookie } = await setup(app)
			const names = Array.from({ length: EXPORT_BATCH_SIZE + 5 }, (_, index) => `key.${String(index).padStart(5, '0')}`)
			const versionId = await versionIdOf(project.id)
			await getTestPrisma().translationKey.createMany({ data: names.map((name) => ({ projectId: project.id, versionId, namespace: 'a', name })) })
			await createKey(project.id, 'b', 'translated', { [sk.id]: 'T' })

			expect((await exportXlsx(app, cookie, project.id, { languageIds: sk.id })).rows).toHaveLength(names.length + 2)
			expect((await exportXlsx(app, cookie, project.id, { languageIds: sk.id, status: 'TRANSLATED' })).rows).toEqual([
				['Namespace', 'Key', 'sk'],
				['b', 'translated', 'T'],
			])
		})
	})

	it('returns 400 for a language of another project and an invalid query', async () => {
		const app = createTestApp()
		const { project, sk, cookie } = await setup(app)
		const foreign = await createLanguage((await createProject()).id, 'sk', { isBase: true })

		expectErrorCode(await exportCsv(app, cookie, project.id, { languageIds: [sk.id, foreign.id].join(',') }), 400, ERROR_CODE.EXPORT_LANGUAGES_INVALID)
		expectErrorCode(await exportCsv(app, cookie, project.id, { languageIds: '' }), 400, ERROR_CODE.VALIDATION_ERROR)
		expectErrorCode(await exportCsv(app, cookie, project.id, { languageIds: sk.id, status: 'REVIEWED' }), 400, ERROR_CODE.VALIDATION_ERROR)
		expectErrorCode(await exportCsv(app, cookie, project.id, { languageIds: sk.id, format: 'JSON' }), 400, ERROR_CODE.VALIDATION_ERROR)
	})

	it('lets a VISITOR member export', async () => {
		const app = createTestApp()
		const { project, sk, cookie } = await setup(app, { role: ROLE.VISITOR })
		await createKey(project.id, 'loc', 'a', { [sk.id]: 'A' })

		expect(await exportOk(app, cookie, project.id, { languageIds: sk.id })).toBe('Keys; sk \n--loc--\n a; A\n')
	})

	it('returns 404 to a non-member and 401 without a session', async () => {
		const app = createTestApp()
		const { project, sk, cookie } = await setup(app, { member: false })

		expectErrorCode(await exportCsv(app, cookie, project.id, { languageIds: sk.id }), 404, ERROR_CODE.NOT_FOUND)
		expectErrorCode(await request(app).get(`/api/projects/${project.id}/export`).query({ languageIds: sk.id }), 401, ERROR_CODE.AUTH_UNAUTHENTICATED)
	})

	describe('limits concurrent exports per process', () => {
		it('refuses an export with 429 and Retry-After while the slot is taken and the queue is full, then frees the slot', async () => {
			const app = createTestApp({ config: { exportMaxConcurrent: 1, exportQueueMax: 0, exportQueueTimeoutMs: 2500 } })
			const { project, sk, cookie } = await setup(app)
			await createKey(project.id, 'loc', 'a', { [sk.id]: 'A' })
			const blocked = blockNextExport()
			try {
				const first = exportCsv(app, cookie, project.id, { languageIds: sk.id }).then((res) => res)
				await blocked.started

				const busy = await exportCsv(app, cookie, project.id, { languageIds: sk.id })
				expectErrorCode(busy, 429, ERROR_CODE.EXPORT_BUSY)
				expect(busy.headers['retry-after']).toBe('3')

				blocked.release()
				expect((await first).text).toBe('Keys; sk \n--loc--\n a; A\n')
				expect(await exportOk(app, cookie, project.id, { languageIds: sk.id })).toBe('Keys; sk \n--loc--\n a; A\n')
			} finally {
				blocked.restore()
			}
		})

		it('lets a queued export run when the slot is released', async () => {
			const app = createTestApp({ config: { exportMaxConcurrent: 1, exportQueueMax: 1 } })
			const { project, sk, cookie } = await setup(app)
			const blocked = blockNextExport()
			try {
				const first = exportCsv(app, cookie, project.id, { languageIds: sk.id }).then((res) => res.status)
				await blocked.started
				let settled = false
				const queued = exportCsv(app, cookie, project.id, { languageIds: sk.id })
					.then((res) => res.status)
					.finally(() => {
						settled = true
					})
				await new Promise((resolve) => setTimeout(resolve, 100))
				expect(settled).toBe(false)

				blocked.release()
				expect(await Promise.all([first, queued])).toEqual([200, 200])
			} finally {
				blocked.restore()
			}
		})

		it('refuses a queued export with 429 after the queue timeout', async () => {
			const app = createTestApp({ config: { exportMaxConcurrent: 1, exportQueueMax: 1, exportQueueTimeoutMs: 100 } })
			const { project, sk, cookie } = await setup(app)
			const blocked = blockNextExport()
			try {
				const first = exportCsv(app, cookie, project.id, { languageIds: sk.id }).then((res) => res.status)
				await blocked.started

				expectErrorCode(await exportCsv(app, cookie, project.id, { languageIds: sk.id }), 429, ERROR_CODE.EXPORT_BUSY)

				blocked.release()
				expect(await first).toBe(200)
			} finally {
				blocked.restore()
			}
		})

		it('frees the slot after a refused export', async () => {
			const app = createTestApp({ config: { exportMaxConcurrent: 1, exportQueueMax: 0 } })
			const { project, sk, cookie } = await setup(app)
			const foreign = await createLanguage((await createProject()).id, 'sk', { isBase: true })
			await createKey(project.id, 'loc', 'a;b', { [sk.id]: 'A' })

			expectErrorCode(await exportCsv(app, cookie, project.id, { languageIds: foreign.id }), 400, ERROR_CODE.EXPORT_LANGUAGES_INVALID)
			expectErrorCode(await exportCsv(app, cookie, project.id, { languageIds: sk.id }), 422, ERROR_CODE.EXPORT_VALUE_UNSAFE)
			expectErrorCode(await exportCsv(app, cookie, project.id, { languageIds: sk.id }), 422, ERROR_CODE.EXPORT_VALUE_UNSAFE)
		})

		it('frees the slot when the client left before the export started', async () => {
			const app = createTestApp({ config: { exportMaxConcurrent: 1, exportQueueMax: 0 } })
			const { project, sk, cookie } = await setup(app)
			await createKey(project.id, 'loc', 'a', { [sk.id]: 'A' })
			const prisma = getTestPrisma()
			const count = prisma.projectMember.count.bind(prisma.projectMember)
			let entered = () => {}
			const accessChecked = new Promise<void>((resolve) => {
				entered = resolve
			})
			let release = () => {}
			const released = new Promise<void>((resolve) => {
				release = resolve
			})
			const spy = vi.spyOn(prisma.projectMember, 'count').mockImplementationOnce((async (...args: Parameters<typeof count>) => {
				entered()
				await released
				return count(...args)
			}) as typeof prisma.projectMember.count)
			const server = app.listen(0)
			try {
				const { port } = server.address() as AddressInfo
				const gone = httpRequest({ port, path: `/api/projects/${project.id}/export?languageIds=${sk.id}`, headers: { Cookie: cookie } })
				gone.on('error', () => undefined)
				gone.end()
				await accessChecked
				gone.destroy()
				await new Promise((resolve) => setTimeout(resolve, 50))
				release()

				await vi.waitFor(async () => {
					expect((await exportCsv(app, cookie, project.id, { languageIds: sk.id })).status).toBe(200)
				})
			} finally {
				spy.mockRestore()
				server.close()
			}
		})

		it('closes the connection after the export timeout and frees the slot', async () => {
			const app = createTestApp({ config: { exportMaxConcurrent: 1, exportQueueMax: 0, exportTimeoutMs: 200 } })
			const { project, sk, cookie } = await setup(app)
			const blocked = blockNextExport()
			try {
				const first = exportCsv(app, cookie, project.id, { languageIds: sk.id }).then(
					(res) => res.status,
					(error: NodeJS.ErrnoException) => error.code,
				)
				await blocked.started

				expect(await first).toBe('ECONNRESET')
				blocked.release()
				await vi.waitFor(async () => {
					expect((await exportCsv(app, cookie, project.id, { languageIds: sk.id })).status).toBe(200)
				})
			} finally {
				blocked.restore()
			}
		})
	})
})

const check = async (app: App, cookie: string, projectId: string, query: Record<string, string>) =>
	request(app)
		.get(`/api/projects/${projectId}/export/check`)
		.query({ versionId: await versionIdOf(projectId), ...query })
		.set('Cookie', cookie)

const checkOk = async (...args: Parameters<typeof check>) => {
	const res = await check(...args)
	expect(res.status).toBe(200)
	return exportCheckResponseSchema.strict().parse(res.body)
}

describe('GET /api/projects/:projectId/export/check', () => {
	it('lists values whose placeholders differ from the base language, in file order, never the base itself', async () => {
		const app = createTestApp()
		const { project, sk, en, cs, cookie } = await setup(app)
		const margin = await createKey(project.id, 'loc', 'margin', {
			[sk.id]: 'Marža {{ percentage }} ({{ amount }})',
			[en.id]: 'Margin {{ perecentage }}',
			[cs.id]: 'Marže {{percentage}} ({{amount}})',
		})
		const hello = await createKey(project.id, 'loc', 'hello', { [sk.id]: 'Ahoj {{name}}', [en.id]: 'Hello', [cs.id]: null })
		const plain = await createKey(project.id, '', 'plain', { [sk.id]: 'Áno', [en.id]: 'Yes {{extra}}' })

		const body = await checkOk(app, cookie, project.id, { languageIds: `${sk.id},${en.id},${cs.id}` })
		expect(body).toEqual({
			warnings: [
				{ keyId: plain.id, namespace: '', key: 'plain', languageTag: 'en', missing: [], extra: ['{{extra}}'] },
				{ keyId: hello.id, namespace: 'loc', key: 'hello', languageTag: 'en', missing: ['{{name}}'], extra: [] },
				{ keyId: margin.id, namespace: 'loc', key: 'margin', languageTag: 'en', missing: ['{{percentage}}', '{{amount}}'], extra: ['{{perecentage}}'] },
			],
			total: 3,
		})
	})

	it('uses the base language as the reference even when it is not exported, and the key name when the base is empty', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app)
		const greeting = await createKey(project.id, 'loc', 'greeting', { [sk.id]: 'Ahoj {{name}}', [en.id]: 'Hello' })
		const named = await createKey(project.id, 'loc', 'Zostáva {{count}} dní', { [en.id]: 'Days left' })
		await createKey(project.id, 'loc', 'free', { [en.id]: 'Anything {{x}}' })

		const body = await checkOk(app, cookie, project.id, { languageIds: en.id })
		expect(body.warnings.map((warning) => [warning.keyId, warning.missing])).toEqual([
			[named.id, ['{{count}}']],
			[greeting.id, ['{{name}}']],
		])
	})

	it('checks only the keys the status keeps and only the exported languages', async () => {
		const app = createTestApp()
		const { project, sk, en, cs, cookie } = await setup(app)
		await createKey(project.id, 'loc', 'done', { [sk.id]: 'A {{a}}', [en.id]: 'A', [cs.id]: 'A' })
		await createKey(project.id, 'loc', 'open', { [sk.id]: 'B {{b}}', [en.id]: 'B' })

		expect(
			(await checkOk(app, cookie, project.id, { languageIds: `${sk.id},${en.id},${cs.id}`, status: 'TRANSLATED' })).warnings.map((w) => [
				w.key,
				w.languageTag,
			]),
		).toEqual([
			['done', 'en'],
			['done', 'cs'],
		])
		expect(
			(await checkOk(app, cookie, project.id, { languageIds: `${sk.id},${en.id},${cs.id}`, status: 'UNTRANSLATED' })).warnings.map((w) => w.key),
		).toEqual(['open'])
		expect((await checkOk(app, cookie, project.id, { languageIds: `${sk.id},${cs.id}` })).warnings.map((w) => [w.key, w.languageTag])).toEqual([
			['done', 'cs'],
		])
	})

	it('caps the list at EXPORT_ISSUES_MAX and keeps the total', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app)
		await Promise.all(
			Array.from({ length: EXPORT_ISSUES_MAX + 3 }, (_, index) =>
				createKey(project.id, 'loc', `k${String(index).padStart(3, '0')}`, { [sk.id]: 'A {{a}}', [en.id]: 'A' }),
			),
		)

		const body = await checkOk(app, cookie, project.id, { languageIds: `${sk.id},${en.id}` })
		expect(body.warnings).toHaveLength(EXPORT_ISSUES_MAX)
		expect(body.total).toBe(EXPORT_ISSUES_MAX + 3)
	})

	it('returns 400 for a language of another project, 404 to a non-member and 401 without a session', async () => {
		const app = createTestApp()
		const { project, sk, cookie } = await setup(app)
		const other = await setup(app, { member: false })

		expectErrorCode(await check(app, cookie, project.id, { languageIds: other.sk.id }), 400, ERROR_CODE.EXPORT_LANGUAGES_INVALID)
		expectErrorCode(await check(app, cookie, project.id, {}), 400, ERROR_CODE.VALIDATION_ERROR)
		expectErrorCode(await check(app, other.cookie, other.project.id, { languageIds: other.sk.id }), 404, ERROR_CODE.NOT_FOUND)
		expectErrorCode(await request(app).get(`/api/projects/${project.id}/export/check`).query({ languageIds: sk.id }), 401, ERROR_CODE.AUTH_UNAUTHENTICATED)
	})
})
