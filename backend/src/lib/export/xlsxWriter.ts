import { type Writable } from 'node:stream'

import ExcelJS from 'exceljs'

import { type ExportRow } from './csvWriter'

/** Characters XML 1.0 does not allow; Excel refuses to open a file with them, so they are dropped from the cell. */
// eslint-disable-next-line no-control-regex -- the control characters are exactly what has to be matched
const XML_INVALID = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g

const toCell = (value: string | null) => (value === null ? null : value.replace(XML_INVALID, ''))

/**
 * One sheet `Translations`: header `Namespace | Key | <tag>…` (frozen, with a filter), a row per key, an untranslated value
 * is an empty cell. Rows are committed as they come, so the workbook streams into `stream` and is not held in memory.
 */
export const createXlsxWriter = (stream: Writable, tags: string[]) => {
	const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream, useStyles: true, useSharedStrings: false })
	const sheet = workbook.addWorksheet('Translations', { views: [{ state: 'frozen', ySplit: 1 }] })
	const wrap = { alignment: { wrapText: true, vertical: 'top' } } as const
	sheet.columns = [
		{ header: 'Namespace', width: 18 },
		{ header: 'Key', width: 40, style: wrap },
		...tags.map((tag) => ({ header: tag, width: 40, style: wrap })),
	]
	sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: tags.length + 2 } }
	const header = sheet.getRow(1)
	header.font = { bold: true }
	header.commit()

	return {
		addRows: (rows: ExportRow[]) => {
			for (const row of rows) {
				sheet.addRow([row.namespace, toCell(row.key), ...row.values.map(toCell)]).commit()
			}
		},
		/** Writes the rest of the file and ends `stream`. */
		finish: async () => {
			sheet.commit()
			await workbook.commit()
		},
	}
}
