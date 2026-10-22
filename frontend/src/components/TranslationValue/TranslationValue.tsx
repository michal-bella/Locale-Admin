import { Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'

import { comparePlaceholders, placeholders } from '@locale/shared'

import PlaceholderWarning from '@/components/PlaceholderWarning/PlaceholderWarning'
import PluralForms from '@/components/PluralForms/PluralForms'
import TranslationText from '@/components/TranslationText/TranslationText'

import classes from './TranslationValue.module.css'
import { type TranslationValueProps } from './types'

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
	const { missing, extra } = reference === undefined ? { missing: [], extra: [] } : comparePlaceholders(reference, value)
	return (
		<>
			{pluralTag ? (
				<PluralForms value={value} tag={pluralTag} basePlaceholders={basePlaceholders} />
			) : (
				<TranslationText value={value} basePlaceholders={basePlaceholders} />
			)}
			<PlaceholderWarning missing={missing} extra={extra} />
		</>
	)
}

export default TranslationValue
