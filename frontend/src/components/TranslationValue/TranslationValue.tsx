import { Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'

import PluralForms from '@/components/PluralForms/PluralForms'
import TranslationText from '@/components/TranslationText/TranslationText'

import classes from './TranslationValue.module.css'
import { type TranslationValueProps } from './types'

/** Read-only value of a key in one language: the placeholder for `null`, stacked forms for a plural key, chips for variables otherwise. */
const TranslationValue = ({ value, pluralTag }: TranslationValueProps) => {
	const { t } = useTranslation()
	if (value === null) {
		return (
			<Text component='span' className={classes.placeholder}>
				{t('translationsPage.table.emptyValue')}
			</Text>
		)
	}
	return pluralTag ? <PluralForms value={value} tag={pluralTag} /> : <TranslationText value={value} />
}

export default TranslationValue
