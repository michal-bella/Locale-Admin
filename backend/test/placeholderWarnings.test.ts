import { randomUUID } from 'node:crypto'

import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { ROLE } from '@locale/shared'

import { seedPlaceholderWarnings } from '../src/lib/placeholderWarnings'

import { createTestApp } from './helpers/app'
import { CSRF_HEADERS, loginAs } from './helpers/auth'
import { getTestPrisma } from './helpers/db'
import { TEST_PASSWORD, createUser } from './helpers/users'
import { createVersionRow, versionIdOf } from './helpers/versions'

type App = ReturnType<typeof createTestApp>

const createProject = (members: string[] = []) =>
	getTestPrisma().project.create({
		data: { name: 'A', slug: `a-${randomUUID().slice(0, 8)}`, members: { create: members.map((userId) => ({ userId })) } },
	})

const createLanguage = (projectId: string, tag: string, isBase = false) => getTestPrisma().projectLanguage.create({ data: { projectId, tag, isBase } })

/** Rows inserted straight into the DB: the flag stays `null`, as for rows from before the column existed. */
const createKey = async (projectId: string, name: string, values: Record<string, string | null> = {}) =>
	getTestPrisma().translationKey.create({
		data: {
			projectId,
			versionId: await versionIdOf(projectId),
			namespace: 'loc',
			name,
			translations: { create: Object.entries(values).map(([languageId, value]) => ({ languageId, value })) },
		},
	})

/** Signs in a new ADMIN who is a member of a new project with `sk` (base) and `en`. */
const setup = async (app: App) => {
	const { user } = await createUser({ role: ROLE.ADMIN })
	const project = await createProject([user.id])
	await createVersionRow(project.id)
	const sk = await createLanguage(project.id, 'sk', true)
	const en = await createLanguage(project.id, 'en')
	return { user, project, sk, en, cookie: await loginAs(app, { email: user.email, password: TEST_PASSWORD }) }
}

const put = (app: App, cookie: string, projectId: string, keyId: string, languageId: string, value: string | null) =>
	request(app).put(`/api/projects/${projectId}/keys/${keyId}/translations/${languageId}`).set('Cookie', cookie).set(CSRF_HEADERS).send({ value })

/** `{ sk: …, en: … }` flags of the key by language tag. */
const flagsOf = async (keyId: string) => {
	const rows = await getTestPrisma().translation.findMany({ where: { keyId }, select: { placeholderWarning: true, language: { select: { tag: true } } } })
	return Object.fromEntries(rows.map((row) => [row.language.tag, row.placeholderWarning]))
}

describe('Translation.placeholderWarning', () => {
	it('is set by a translation edit and cleared again, never on the base language of a key without variables', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app)
		const key = await createKey(project.id, 'items', { [sk.id]: 'Máte {{count}} položiek' })
		await getTestPrisma().project.update({ where: { id: project.id }, data: { protectVariables: false } })

		expect((await put(app, cookie, project.id, key.id, en.id, 'You have items')).status).toBe(200)
		expect(await flagsOf(key.id)).toEqual({ sk: false, en: true })

		expect((await put(app, cookie, project.id, key.id, en.id, 'You have {{count}} items')).status).toBe(200)
		expect(await flagsOf(key.id)).toEqual({ sk: false, en: false })
	})

	it('recomputes the other languages when the base value changes', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app)
		const key = await createKey(project.id, 'items', { [sk.id]: 'Máte {{count}} položiek', [en.id]: 'You have {{count}} items' })

		expect((await put(app, cookie, project.id, key.id, sk.id, 'Máte {{total}} položiek')).status).toBe(200)
		expect(await flagsOf(key.id)).toEqual({ sk: false, en: true })
	})

	it('is computed for a key created by hand and for every language of an import', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app)
		await createKey(project.id, 'existing')
		await getTestPrisma().project.update({ where: { id: project.id }, data: { protectVariables: false } })

		const created = await request(app)
			.post(`/api/projects/${project.id}/keys`)
			.set('Cookie', cookie)
			.set(CSRF_HEADERS)
			.send({
				versionId: await versionIdOf(project.id),
				namespace: 'loc',
				name: 'greeting',
				translations: { [sk.id]: 'Ahoj {{name}}', [en.id]: 'Hello' },
			})
		expect(created.status).toBe(201)
		expect(await flagsOf((created.body as { keyId: string }).keyId)).toEqual({ sk: false, en: true })

		const imported = await request(app)
			.post(`/api/projects/${project.id}/imports`)
			.set('Cookie', cookie)
			.set(CSRF_HEADERS)
			.send({
				versionId: await versionIdOf(project.id),
				fileName: 'translations.csv',
				content: [
					'Keys; sk ; en',
					'--loc--',
					' a; {{count}} ks; {{count}} pcs',
					' b; {{count}} ks; pcs',
					' greeting; Ahoj {{name}}; Hello {{name}}',
				].join('\n'),
				columns: [
					{ columnIndex: 2, languageId: sk.id },
					{ columnIndex: 3, languageId: en.id },
				],
				createMissingKeys: true,
			})
		expect(imported.status).toBe(200)
		const keys = await getTestPrisma().translationKey.findMany({ where: { projectId: project.id }, select: { id: true, name: true } })
		const byName = Object.fromEntries(keys.map(({ name, id }) => [name, id]))
		expect(await flagsOf(byName['a']!)).toEqual({ sk: false, en: false })
		expect(await flagsOf(byName['b']!)).toEqual({ sk: false, en: true })
		expect(await flagsOf(byName['greeting']!)).toEqual({ sk: false, en: false })
	})

	it('follows a renamed sentence key and a changed base language', async () => {
		const app = createTestApp()
		const { project, sk, en, cookie } = await setup(app)
		const key = await createKey(project.id, 'Cena ({{symbol}})', { [sk.id]: null, [en.id]: 'Price' })
		await seedPlaceholderWarnings(getTestPrisma())
		expect(await flagsOf(key.id)).toEqual({ sk: false, en: true })

		const renamed = await request(app).patch(`/api/projects/${project.id}/keys/${key.id}`).set('Cookie', cookie).set(CSRF_HEADERS).send({ name: 'Cena' })
		expect(renamed.status).toBe(200)
		expect(await flagsOf(key.id)).toEqual({ sk: false, en: false })

		const other = await createKey(project.id, 'items', { [sk.id]: 'Máte {{count}} položiek', [en.id]: 'You have {{count}} items' })
		await getTestPrisma().translation.update({
			where: { keyId_languageId: { keyId: other.id, languageId: en.id } },
			data: { value: 'You have {{count}} {{count}} items' },
		})
		const settings = await request(app)
			.patch(`/api/projects/${project.id}/settings`)
			.set('Cookie', cookie)
			.set(CSRF_HEADERS)
			.send({ name: 'A', slug: project.slug, primaryColor: '#123ABC', protectVariables: true, baseLanguageId: en.id })
		expect(settings.status).toBe(200)
		// en is the base now: its cell is fine by definition and sk has {{count}} once against twice.
		expect(await flagsOf(other.id)).toEqual({ sk: true, en: false })
	})

	it('flags the base value of a sentence key that dropped a variable, not the languages that kept it', async () => {
		const app = createTestApp()
		const { project, sk, en } = await setup(app)
		const key = await createKey(project.id, 'Na udalosť je prihlásených {{count}} ľudí.', {
			[sk.id]: 'Klientom bude odoslaná notifikácia.',
			[en.id]: '{{count}} clients are already booked.',
		})

		await seedPlaceholderWarnings(getTestPrisma())

		expect(await flagsOf(key.id)).toEqual({ sk: true, en: false })
	})

	it('seedPlaceholderWarnings fills only the rows that are still null and reports the keys it touched', async () => {
		const app = createTestApp()
		const { project, sk, en } = await setup(app)
		const bad = await createKey(project.id, 'a', { [sk.id]: '{{a}}', [en.id]: '{{b}}' })
		const fine = await createKey(project.id, 'b', { [sk.id]: '{{a}}', [en.id]: '{{a}}' })
		const done = await createKey(project.id, 'c', { [sk.id]: 'x', [en.id]: 'y' })
		await getTestPrisma().translation.updateMany({ where: { keyId: done.id }, data: { placeholderWarning: false } })

		expect(await seedPlaceholderWarnings(getTestPrisma())).toBe(2)
		expect(await flagsOf(bad.id)).toEqual({ sk: false, en: true })
		expect(await flagsOf(fine.id)).toEqual({ sk: false, en: false })
		expect(await seedPlaceholderWarnings(getTestPrisma())).toBe(0)
	})
})
