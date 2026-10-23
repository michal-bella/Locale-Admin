import { Tooltip, VisuallyHidden } from '@mantine/core'
import { useTranslation } from 'react-i18next'

import TranslationValue from '@/components/TranslationValue/TranslationValue'

import classes from './TranslationCell.module.css'
import { type TranslationCellProps } from './types'

const TOOLTIP_EVENTS = { hover: true, focus: false, touch: true } as const

/**
 * A translation in the table: a button with the read-only value that opens `EditTranslationModal`, or the same box as plain text without
 * `onClick`; an untranslated cell is an empty box with a soft red background and a red border (Bez prekladu only for screen readers), a
 * `changed` one a brand left border.
 */
const TranslationCell = ({ cell, label, pluralTag, reference, changed = false, onClick }: TranslationCellProps) => {
	const { t } = useTranslation()
	const content = (
		<span className={classes.content}>
			<VisuallyHidden>
				{label}:{changed && ` ${t('translationsPage.table.diffChanged')}:`}
			</VisuallyHidden>{' '}
			{cell.value === null ? (
				<VisuallyHidden>{t('translationsPage.table.emptyValue')}</VisuallyHidden>
			) : (
				<TranslationValue value={cell.value} pluralTag={pluralTag} reference={reference} />
			)}
		</span>
	)
	const changedAttribute = changed || undefined
	return (
		<Tooltip label={t('translationsPage.table.diffChangedTooltip')} disabled={!changed} events={TOOLTIP_EVENTS}>
			{onClick ? (
				<button type='button' className={classes.button} data-status={cell.status} data-changed={changedAttribute} onClick={onClick}>
					{content}
				</button>
			) : (
				<div className={classes.button} data-status={cell.status} data-changed={changedAttribute} data-readonly>
					{content}
				</div>
			)}
		</Tooltip>
	)
}

export default TranslationCell
