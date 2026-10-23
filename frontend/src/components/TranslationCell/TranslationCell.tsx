import { Tooltip, VisuallyHidden } from '@mantine/core'
import { useTranslation } from 'react-i18next'

import { comparePlaceholders } from '@locale/shared'

import { placeholderWarningMessage } from '@/components/PlaceholderWarning/placeholderWarningMessage'
import TranslationValue from '@/components/TranslationValue/TranslationValue'

import classes from './TranslationCell.module.css'
import { type TranslationCellProps } from './types'

const TOOLTIP_EVENTS = { hover: true, focus: false, touch: true } as const

/**
 * A translation in the table: a button with the read-only value that opens `EditTranslationModal`, or the same box as plain text without
 * `onClick`; an untranslated cell is an empty box with a soft red background and a red border (Bez prekladu only for screen readers), a
 * `changed` one a brand left border, one whose variables differ from `reference` an orange border. The cell's tooltip says why (the
 * variable warning, then the change), so the warning icon and chips inside have none of their own.
 */
const TranslationCell = ({ cell, label, pluralTag, reference, changed = false, onClick }: TranslationCellProps) => {
	const { t } = useTranslation()
	const warning = reference === undefined || cell.value === null ? null : placeholderWarningMessage(t, comparePlaceholders(reference, cell.value))
	const tooltip = [warning, changed && t('translationsPage.table.diffChangedTooltip')].filter(Boolean).join(' ')
	const content = (
		<span className={classes.content}>
			<VisuallyHidden>
				{label}:{changed && ` ${t('translationsPage.table.diffChanged')}:`}
			</VisuallyHidden>{' '}
			{cell.value === null ? (
				<VisuallyHidden>{t('translationsPage.table.emptyValue')}</VisuallyHidden>
			) : (
				<TranslationValue value={cell.value} pluralTag={pluralTag} reference={reference} tooltips={false} />
			)}
		</span>
	)
	const changedAttribute = changed || undefined
	const warningAttribute = warning !== null || undefined
	return (
		<Tooltip label={tooltip} disabled={tooltip === ''} events={TOOLTIP_EVENTS} multiline={warning !== null} w={warning === null ? undefined : 260}>
			{onClick ? (
				<button
					type='button'
					className={classes.button}
					data-status={cell.status}
					data-changed={changedAttribute}
					data-warning={warningAttribute}
					onClick={onClick}
				>
					{content}
				</button>
			) : (
				<div className={classes.button} data-status={cell.status} data-changed={changedAttribute} data-warning={warningAttribute} data-readonly>
					{content}
				</div>
			)}
		</Tooltip>
	)
}

export default TranslationCell
