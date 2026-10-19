import { describe, expect, it } from 'vitest'

import { IMPORT_ISSUES_MAX, IMPORT_KEY_MAX_BYTES, IMPORT_NAMESPACE_MAX_LENGTH } from '@locale/shared'

import { parseCsv } from './csvParser'

const SAMPLE = [
	'Keys; cs ; en ; sk ',
	'--common--',
	' Uložiť; Uložit; Save; Uložiť',
	' Máte {{ count }} položiek; Máte {{count}} položek; You have {{ count }} items; Máte {{ count }} položiek',
	' Prečítajte si <a href="/podmienky">podmienky</a>.; null; Read the <a href="/terms">terms</a>.; Prečítajte si <a href="/podmienky">podmienky</a>.',
	'',
	'--routes--',
	' Uložiť; ""; ""; /ulozit',
	' orders.empty.title; Žádné objednávky;   No orders  ; Žiadne objednávky',
].join('\n')

const parseOk = (content: string) => {
	const result = parseCsv(content)
	if (!result.ok) {
		throw new Error(`Expected a parsed file, got ${JSON.stringify(result.issues)}`)
	}
	return result.file
}

const parseIssues = (content: string) => {
	const result = parseCsv(content)
	if (result.ok) {
		throw new Error('Expected issues')
	}
	return result
}

describe('parseCsv', () => {
	it('parses the header, sections and rows with trimmed values, null and "" as null', () => {
		expect(parseOk(SAMPLE)).toEqual({
			headerLine: 1,
			columns: [
				{ tag: 'cs', columnIndex: 2 },
				{ tag: 'en', columnIndex: 3 },
				{ tag: 'sk', columnIndex: 4 },
			],
			rows: [
				{ line: 3, namespace: 'common', key: 'Uložiť', values: ['Uložit', 'Save', 'Uložiť'] },
				{
					line: 4,
					namespace: 'common',
					key: 'Máte {{ count }} položiek',
					values: ['Máte {{count}} položek', 'You have {{ count }} items', 'Máte {{ count }} položiek'],
				},
				{
					line: 5,
					namespace: 'common',
					key: 'Prečítajte si <a href="/podmienky">podmienky</a>.',
					values: [null, 'Read the <a href="/terms">terms</a>.', 'Prečítajte si <a href="/podmienky">podmienky</a>.'],
				},
				{ line: 8, namespace: 'routes', key: 'Uložiť', values: [null, null, '/ulozit'] },
				{ line: 9, namespace: 'routes', key: 'orders.empty.title', values: ['Žádné objednávky', 'No orders', 'Žiadne objednávky'] },
			],
		})
	})

	it('strips a BOM and accepts \\r\\n line endings', () => {
		expect(parseOk(`\uFEFF${SAMPLE.replaceAll('\n', '\r\n')}`)).toEqual(parseOk(SAMPLE))
	})

	it('accepts old Mac \\r line endings and mixed line endings', () => {
		expect(parseOk(SAMPLE.replaceAll('\n', '\r'))).toEqual(parseOk(SAMPLE))
		expect(parseOk('Keys; en\r\n a; A\r b; B\n c; C').rows.map(({ line, key }) => [line, key])).toEqual([
			[2, 'a'],
			[3, 'b'],
			[4, 'c'],
		])
	})

	it('accepts a trailing ; when an editor stripped the space of an empty last field', () => {
		expect(parseOk('Keys; en ; sk\n a; A;\n b; ;\n c; C; C').rows.map(({ values }) => values)).toEqual([
			['A', null],
			[null, null],
			['C', 'C'],
		])
	})

	it('keeps a ; that ends a value when the field count is right', () => {
		expect(parseOk('Keys; en ; sk\n a; A; B&nbsp;').rows[0]?.values).toEqual(['A', 'B&nbsp;'])
	})

	it('puts rows before the first section into the empty namespace and keeps line numbers across blank lines', () => {
		const file = parseOk('\n\nKeys; en\n\n Ahoj; Hello\n\n--loc--\n Ahoj; Hi\n')

		expect(file.headerLine).toBe(3)
		expect(file.rows).toEqual([
			{ line: 5, namespace: '', key: 'Ahoj', values: ['Hello'] },
			{ line: 8, namespace: 'loc', key: 'Ahoj', values: ['Hi'] },
		])
	})

	it('treats an empty field as null', () => {
		expect(parseOk('Keys; en ; sk\n Ahoj; ; Ahoj').rows[0]?.values).toEqual([null, 'Ahoj'])
	})

	it.each([
		{ name: 'empty content', content: '' },
		{ name: 'whitespace only', content: '  \n\r\n\t' },
		{ name: 'BOM only', content: '\uFEFF' },
		{ name: 'header only', content: 'Keys; en\n\n' },
		{ name: 'header and sections only', content: 'Keys; en\n--loc--\n' },
	])('returns FILE_EMPTY for $name', ({ content }) => {
		expect(parseIssues(content)).toEqual({ ok: false, issues: [{ code: 'FILE_EMPTY' }], total: 1 })
	})

	it('returns FILE_NOT_UTF8 for every line with a replacement character or a lone surrogate', () => {
		expect(parseIssues('Keys; en\n Ahoj; Hell\uFFFD\n Dobre; Good\n Zle; \uD800x\n Zle2; x\uDC00')).toEqual({
			ok: false,
			issues: [
				{ code: 'FILE_NOT_UTF8', line: 2 },
				{ code: 'FILE_NOT_UTF8', line: 4 },
				{ code: 'FILE_NOT_UTF8', line: 5 },
			],
			total: 3,
		})
	})

	it('accepts a valid surrogate pair (emoji)', () => {
		expect(parseOk('Keys; en\n Palec; 👍').rows[0]?.values).toEqual(['👍'])
	})

	it.each([
		{ name: 'a wrong first column', content: 'Key; en\n a; b' },
		{ name: 'a lower-case first column', content: 'keys; en\n a; b' },
		{ name: 'no language column', content: 'Keys\n a' },
		{ name: 'a comma-separated header', content: 'Keys, en, sk\n a, b, c' },
		{ name: 'a header separated by ; without spaces', content: 'Keys;en\n a;b' },
	])('returns HEADER_INVALID for $name', ({ content }) => {
		expect(parseIssues(content).issues).toEqual([{ code: 'HEADER_INVALID', line: 1, column: 1 }])
	})

	it('returns HEADER_EMPTY_TAG and HEADER_DUPLICATE_TAG (case-insensitive) and stops before the rows', () => {
		expect(parseIssues('Keys; en ;  ; sk ; EN ; sk\n a; b').issues).toEqual([
			{ code: 'HEADER_EMPTY_TAG', line: 1, column: 3 },
			{ code: 'HEADER_DUPLICATE_TAG', line: 1, column: 5, params: { tag: 'EN', firstColumn: 2 } },
			{ code: 'HEADER_DUPLICATE_TAG', line: 1, column: 6, params: { tag: 'sk', firstColumn: 4 } },
		])
	})

	it('returns row issues in file order with line numbers and params', () => {
		const longKey = 'k'.repeat(IMPORT_KEY_MAX_BYTES + 1)
		const content = [
			'Keys; en ; sk',
			' Ahoj; Hello; Ahoj',
			' Viac; a; b; c',
			' Menej; a',
			' ; a; b',
			` ${longKey}; a; b`,
			'--loc--',
			' Ahoj; Hi; Ahoj',
			' Ahoj; Hey; Ahoj',
			'----',
			'--bad name--',
			'--..--',
			'--a/b--',
			`--${'n'.repeat(IMPORT_NAMESPACE_MAX_LENGTH + 1)}--`,
		].join('\n')

		expect(parseIssues(content)).toEqual({
			ok: false,
			issues: [
				{ code: 'ROW_COLUMN_COUNT', line: 3, params: { expected: 3, actual: 4 } },
				{ code: 'ROW_COLUMN_COUNT', line: 4, params: { expected: 3, actual: 2 } },
				{ code: 'ROW_EMPTY_KEY', line: 5, column: 1 },
				{ code: 'KEY_TOO_LONG', line: 6, column: 1, params: { max: IMPORT_KEY_MAX_BYTES, length: IMPORT_KEY_MAX_BYTES + 1 } },
				{ code: 'ROW_DUPLICATE_KEY', line: 9, column: 1, params: { key: 'Ahoj', namespace: 'loc', firstLine: 8 } },
				{ code: 'NAMESPACE_INVALID', line: 10, params: { namespace: '' } },
				{ code: 'NAMESPACE_INVALID', line: 11, params: { namespace: 'bad name' } },
				{ code: 'NAMESPACE_INVALID', line: 12, params: { namespace: '..' } },
				{ code: 'NAMESPACE_INVALID', line: 13, params: { namespace: 'a/b' } },
				{ code: 'NAMESPACE_INVALID', line: 14, params: { namespace: 'n'.repeat(IMPORT_NAMESPACE_MAX_LENGTH + 1) } },
			],
			total: 10,
		})
	})

	it('counts key length in UTF-8 bytes: Cyrillic takes 2 bytes per character, an emoji 4', () => {
		const cyrillic = 'ж'.repeat(IMPORT_KEY_MAX_BYTES / 2)
		expect(parseOk(`Keys; ru\n ${cyrillic}; Привет`).rows[0]?.key).toBe(cyrillic)
		expect(parseIssues(`Keys; ru\n ${cyrillic}ж; Привет`).issues).toEqual([
			{ code: 'KEY_TOO_LONG', line: 2, column: 1, params: { max: IMPORT_KEY_MAX_BYTES, length: IMPORT_KEY_MAX_BYTES + 2 } },
		])
		expect(parseOk(`Keys; en\n ${'\u{1F44D}'.repeat(IMPORT_KEY_MAX_BYTES / 4)}; a`).rows).toHaveLength(1)
		expect(parseIssues(`Keys; en\n ${'\u{1F44D}'.repeat(IMPORT_KEY_MAX_BYTES / 4 + 1)}; a`).issues).toEqual([
			{ code: 'KEY_TOO_LONG', line: 2, column: 1, params: { max: IMPORT_KEY_MAX_BYTES, length: IMPORT_KEY_MAX_BYTES + 4 } },
		])
	})

	it(`accepts a namespace of ${IMPORT_NAMESPACE_MAX_LENGTH} characters`, () => {
		const namespace = 'n'.repeat(IMPORT_NAMESPACE_MAX_LENGTH)
		expect(parseOk(`Keys; en\n--${namespace}--\n a; b`).rows[0]?.namespace).toBe(namespace)
	})

	it('accepts namespaces with dots, dashes and underscores', () => {
		const file = parseOk('Keys; en\n--notino-partner_v2.1--\n a; b')
		expect(file.rows[0]?.namespace).toBe('notino-partner_v2.1')
	})

	it(`returns the first ${IMPORT_ISSUES_MAX} issues and the total count`, () => {
		const rows = Array.from({ length: 120 }, (_, index) => ` key${index}; a; b`)
		const result = parseIssues(['Keys; en', ...rows].join('\n'))

		expect(result.total).toBe(120)
		expect(result.issues).toHaveLength(IMPORT_ISSUES_MAX)
		expect(result.issues[0]).toEqual({ code: 'ROW_COLUMN_COUNT', line: 2, params: { expected: 2, actual: 3 } })
		expect(result.issues.at(-1)?.line).toBe(IMPORT_ISSUES_MAX + 1)
	})
})
