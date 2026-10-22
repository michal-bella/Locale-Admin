import { VisuallyHidden } from '@mantine/core'
import { useTranslation } from 'react-i18next'

import TranslationValue from '@/components/TranslationValue/TranslationValue'

import classes from './TranslationCell.module.css'
import { type TranslationCellProps } from './types'

/**
 * A translation in the table: a button with the read-only value that opens `EditTranslationModal`, or the same box as plain text without
 * `onClick`; an untranslated cell has a soft red background, a `changed` one a brand left border.
 */
const TranslationCell = ({ cell, label, pluralTag, reference, changed = false, onClick }: TranslationCellProps) => {
	const { t } = useTranslation()
	const content = (
		<span className={classes.content}>
			<VisuallyHidden>
				{label}:{changed && ` ${t('translationsPage.table.diffChanged')}:`}
			</VisuallyHidden>{' '}
			<TranslationValue value={cell.value} pluralTag={pluralTag} reference={reference} />
		</span>
	)
	const changedAttribute = changed || undefined
	return onClick ? (
		<button type='button' className={classes.button} data-status={cell.status} data-changed={changedAttribute} onClick={onClick}>
			{content}
		</button>
	) : (
		<div className={classes.button} data-status={cell.status} data-changed={changedAttribute} data-readonly>
			{content}
		</div>
	)
}

export default TranslationCell
