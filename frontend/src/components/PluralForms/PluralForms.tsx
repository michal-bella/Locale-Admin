import { Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'

import TranslationText from '@/components/TranslationText/TranslationText'
import { parsePluralForms, pluralFormsOf } from '@/lib/pluralForms'

import PluralFormChip from './PluralFormChip'
import classes from './PluralForms.module.css'
import { type PluralFormsProps } from './types'

/** Read-only plural forms of a value stacked like Tolgee: a form chip and the text with `#` and `{{…}}` chips; a missing form shows the empty text. */
const PluralForms = ({ value, tag, basePlaceholders }: PluralFormsProps) => {
	const { t } = useTranslation()
	const forms = parsePluralForms(value)
	return (
		<span className={classes.list}>
			{pluralFormsOf(tag, forms).map((form) => {
				const text = forms[form]
				return (
					<span key={form} className={classes.form}>
						<PluralFormChip form={form} />
						{text ? (
							<TranslationText value={text} pluralHash basePlaceholders={basePlaceholders} />
						) : (
							<Text component='span' className={classes.empty}>
								{t('translationsPage.table.emptyValue')}
							</Text>
						)}
					</span>
				)
			})}
		</span>
	)
}

export default PluralForms
