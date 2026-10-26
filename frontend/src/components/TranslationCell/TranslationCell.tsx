import { Tooltip, VisuallyHidden } from '@mantine/core'
import { useTranslation } from 'react-i18next'

import { comparePlaceholders } from '@locale/shared'

import { SwitchHorizontal } from '@/components/Icons'
import { placeholderWarningMessage } from '@/components/PlaceholderWarning/placeholderWarningMessage'
import TranslationValue from '@/components/TranslationValue/TranslationValue'

import classes from './TranslationCell.module.css'
import { type TranslationCellProps } from './types'

const TOOLTIP_EVENTS = { hover: true, focus: false, touch: true } as const

/**
 * A translation in the table: a button with the read-only value that opens `EditTranslationModal`; an untranslated cell is an empty box
 * with a red border (Bez prekladu only for screen readers), a `changed` one a brand ⇄ icon next to where the variable warning icon goes,
 * one whose variables differ from `reference` an orange border. The cell's tooltip says why (Nepreložené or the variable warning, then the
 * change), so the icons and chips inside have none of their own.
 */
const TranslationCell = ({ cell, label, pluralTag, reference, changed = false, onClick }: TranslationCellProps) => {
	const { t } = useTranslation()
	const warning = reference === undefined || cell.value === null ? null : placeholderWarningMessage(t, comparePlaceholders(reference, cell.value))
	const reasons = [
		cell.value === null && t('translationsPage.status.UNTRANSLATED'),
		warning,
		changed && t('translationsPage.table.diffChangedTooltip'),
	].filter((reason): reason is string => Boolean(reason))
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
			{changed && (
				<span className={classes.changedIcon} data-diff-changed aria-hidden>
					<SwitchHorizontal />
				</span>
			)}
		</span>
	)
	const changedAttribute = changed || undefined
	const warningAttribute = warning !== null || undefined
	return (
		<Tooltip
			label={reasons.map((reason) => (
				<div key={reason}>{reason}</div>
			))}
			disabled={reasons.length === 0}
			events={TOOLTIP_EVENTS}
			multiline={warning !== null}
			w={warning === null ? undefined : 260}
		>
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
		</Tooltip>
	)
}

export default TranslationCell
