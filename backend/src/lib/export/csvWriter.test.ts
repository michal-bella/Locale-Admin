import { describe, expect, it } from 'vitest'

import { parseCsv } from '../import/csvParser'

import { csvHeader, csvRow, csvSection, rowIssues, type ExportRow } from './csvWriter'

const KEY_ID = '0b6f6f5e-2f4e-4a3b-9c1d-1e2f3a4b5c6d'

const row = (key: string, values: (string | null)[], namespace = 'loc'): ExportRow => ({ keyId: KEY_ID, namespace, key, values })

describe('csvWriter', () => {
	it('writes the i18nextJsonToCsv format that parseCsv reads back', () => {
		const content = [
			csvHeader(['sk', 'en']),
			csvSection('loc'),
			csvRow(row('Uložiť', ['Uložiť', 'Save'])),
			csvRow(row('Zrušiť', ['Zrušiť', null])),
			csvSection('paths'),
			csvRow(row('orders', [null, '/orders'], 'paths')),
		].join('')

		expect(content).toBe('Keys; sk ; en \n--loc--\n Uložiť; Uložiť; Save\n Zrušiť; Zrušiť; null\n--paths--\n orders; null; /orders\n')
		expect(parseCsv(content)).toMatchObject({
			ok: true,
			file: {
				rows: [
					{ namespace: 'loc', key: 'Uložiť', values: ['Uložiť', 'Save'] },
					{ namespace: 'loc', key: 'Zrušiť', values: ['Zrušiť', null] },
					{ namespace: 'paths', key: 'orders', values: [null, '/orders'] },
				],
			},
		})
	})

	it('reports a semicolon and a line break in the key or a value, with the language of the value', () => {
		expect(rowIssues(row('a;b', ['x', 'y\nz', 'Ahoj&nbsp;']), ['sk', 'en', 'cs'])).toEqual([
			{ code: 'SEMICOLON', keyId: KEY_ID, namespace: 'loc', key: 'a;b', languageTag: null },
			{ code: 'LINE_BREAK', keyId: KEY_ID, namespace: 'loc', key: 'a;b', languageTag: 'en' },
			{ code: 'SEMICOLON', keyId: KEY_ID, namespace: 'loc', key: 'a;b', languageTag: 'cs' },
		])
		expect(rowIssues(row('a', ['x\r']), ['sk'])).toMatchObject([{ code: 'LINE_BREAK', languageTag: 'sk' }])
	})

	it('reports a section marker anywhere in the row, also across fields, but not an empty one or a single dash pair', () => {
		expect(rowIssues(row('a', ['Od --9-- do']), ['sk'])).toMatchObject([{ code: 'SECTION_MARKER', languageTag: null }])
		expect(rowIssues(row('a --', ['-- b']), ['sk'])).toMatchObject([{ code: 'SECTION_MARKER' }])
		expect(rowIssues(row('a', ['x ---- y', 'Jeden -- druhý']), ['sk', 'en'])).toEqual([])
		expect(rowIssues(row('a', [null, 'ok']), ['sk', 'en'])).toEqual([])
	})
})
