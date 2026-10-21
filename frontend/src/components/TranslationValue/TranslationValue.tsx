import { Text, Tooltip } from '@mantine/core'
import { useTranslation } from 'react-i18next'

import { comparePlaceholders, placeholders } from '@locale/shared'

import { AlertTriangle } from '@/components/Icons'
import PluralForms from '@/components/PluralForms/PluralForms'
import TranslationText from '@/components/TranslationText/TranslationText'
import textClasses from '@/components/TranslationText/TranslationText.module.css'

import classes from './TranslationValue.module.css'
import { type TranslationValueProps } from './types'

const TOOLTIP_EVENTS = { hover: true, focus: false, touch: true } as const

/** Read-only value of a key in one language: the placeholder for `null`, stacked forms for a plural key, chips for variables otherwise. */
const TranslationValue = ({ value, pluralTag, reference }: TranslationValueProps) => {
	const { t } = useTranslation()
	if (value === null) {
		return (
			<Text component='span' className={classes.placeholder}>
				{t('translationsPage.table.emptyValue')}
			</Text>
		)
	}
	const basePlaceholders = reference === undefined ? undefined : placeholders(reference)
	const missing = reference === undefined ? [] : comparePlaceholders(reference, value).missing
	return (
		<>
			{pluralTag ? (
				<PluralForms value={value} tag={pluralTag} basePlaceholders={basePlaceholders} />
			) : (
				<TranslationText value={value} basePlaceholders={basePlaceholders} />
			)}
			{missing.length > 0 && (
				<Tooltip label={t('translationsPage.editor.missing', { list: missing.join(', ') })} events={TOOLTIP_EVENTS} multiline w={260}>
					<span className={textClasses.missing} role='img' aria-label={t('translationsPage.editor.missing', { list: missing.join(', ') })}>
						<AlertTriangle aria-hidden />
					</span>
				</Tooltip>
			)}
		</>
	)
}

export default TranslationValue
