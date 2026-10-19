import { VisuallyHidden } from '@mantine/core'

import TranslationValue from '@/components/TranslationValue/TranslationValue'

import classes from './TranslationCell.module.css'
import { type TranslationCellProps } from './types'

/** A translation in the table: a button with the read-only value that opens `EditTranslationModal`; an untranslated cell has a soft red background. */
const TranslationCell = ({ cell, label, pluralTag, onClick }: TranslationCellProps) => (
	<button type='button' className={classes.button} data-status={cell.status} onClick={onClick}>
		<span className={classes.content}>
			<VisuallyHidden>{label}:</VisuallyHidden> <TranslationValue value={cell.value} pluralTag={pluralTag} />
		</span>
	</button>
)

export default TranslationCell
