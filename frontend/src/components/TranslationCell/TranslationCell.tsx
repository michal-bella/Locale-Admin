import { VisuallyHidden } from '@mantine/core'

import TranslationValue from '@/components/TranslationValue/TranslationValue'

import classes from './TranslationCell.module.css'
import { type TranslationCellProps } from './types'

/**
 * A translation in the table: a button with the read-only value that opens `EditTranslationModal`, or the same box as plain text without
 * `onClick`; an untranslated cell has a soft red background.
 */
const TranslationCell = ({ cell, label, pluralTag, reference, onClick }: TranslationCellProps) => {
	const content = (
		<span className={classes.content}>
			<VisuallyHidden>{label}:</VisuallyHidden> <TranslationValue value={cell.value} pluralTag={pluralTag} reference={reference} />
		</span>
	)
	return onClick ? (
		<button type='button' className={classes.button} data-status={cell.status} onClick={onClick}>
			{content}
		</button>
	) : (
		<div className={classes.button} data-status={cell.status} data-readonly>
			{content}
		</div>
	)
}

export default TranslationCell
