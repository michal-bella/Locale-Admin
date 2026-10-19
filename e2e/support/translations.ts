import { type APIRequestContext, expect } from '@playwright/test'

import { withDb } from './db'
import { type Language } from './languages'

export const projectTranslationsApi = (projectId: string) => `/api/projects/${projectId}/translations`

/** `values` per language tag: a string or `null` inserts a `Translation` row, a missing tag inserts none. */
export type TestTranslationKey = { namespace?: string; name: string; values?: Partial<Record<string, string | null>> }

/**
 * Inserts keys and translations of a test project directly into the DB: there is no API to create keys before the import milestone.
 * The rows cascade with the project, so the teardown deletes them with the `e2e-tmp-` projects.
 */
export const insertTranslationKeys = (projectId: string, languages: Language[], keys: TestTranslationKey[]) =>
	withDb(async (client) => {
		const languageIds = new Map(languages.map(({ tag, id }) => [tag, id]))
		await client.query('BEGIN')
		try {
			const inserted = await client.query<{ id: string; namespace: string; name: string }>(
				`INSERT INTO "TranslationKey" (id, "projectId", namespace, name, "updatedAt")
				 SELECT gen_random_uuid(), $1, namespace, name, now() FROM unnest($2::text[], $3::text[]) AS input(namespace, name)
				 RETURNING id, namespace, name`,
				[projectId, keys.map(({ namespace = '' }) => namespace), keys.map(({ name }) => name)],
			)
			const keyIds = new Map(inserted.rows.map(({ id, namespace, name }) => [`${namespace}\u0000${name}`, id]))
			const rows = keys.flatMap(({ namespace = '', name, values = {} }) =>
				Object.entries(values).map(([tag, value]) => {
					const languageId = languageIds.get(tag)
					if (!languageId) {
						throw new Error(`Language ${tag} is not in project ${projectId}`)
					}
					return { keyId: keyIds.get(`${namespace}\u0000${name}`)!, languageId, value: value ?? null }
				}),
			)
			await client.query(
				`INSERT INTO "Translation" ("keyId", "languageId", value, "updatedAt")
				 SELECT "keyId", "languageId", value, now() FROM unnest($1::uuid[], $2::uuid[], $3::text[]) AS input("keyId", "languageId", value)`,
				[rows.map(({ keyId }) => keyId), rows.map(({ languageId }) => languageId), rows.map(({ value }) => value)],
			)
			await client.query('COMMIT')
		} catch (error) {
			await client.query('ROLLBACK')
			throw error
		}
	})

export const translationApi = (projectId: string, keyId: string, languageId: string) => `/api/projects/${projectId}/keys/${keyId}/translations/${languageId}`

export type TranslationListItem = {
	keyId: string
	namespace: string
	name: string
	group: string
	source: { value: string | null }
	target: { value: string | null; status: 'TRANSLATED' | 'UNTRANSLATED'; updatedAt: string | null }
}

export type TranslationsResponse = {
	items: TranslationListItem[]
	total: number
	page: number
	pageSize: number
	stats: { totalKeys: number; translated: number; untranslated: number }
	namespaces: string[]
}

export const listTranslations = async (api: APIRequestContext, projectId: string, sourceLanguageId: string, targetLanguageId: string) => {
	const response = await api.get(projectTranslationsApi(projectId), { params: { sourceLanguageId, targetLanguageId } })
	expect(response.status(), `GET ${projectTranslationsApi(projectId)}`).toBe(200)
	return (await response.json()) as TranslationsResponse
}
