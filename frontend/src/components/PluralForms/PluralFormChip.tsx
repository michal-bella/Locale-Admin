import { useTranslation } from 'react-i18next'

import classes from './PluralForms.module.css'
import { type PluralFormChipProps } from './types'

/** CLDR name of a plural form (One, Few, Many, Other) like Tolgee; the translated name is the tooltip. */
const PluralFormChip = ({ form }: PluralFormChipProps) => {
	const { t } = useTranslation()
	return (
		<span className={classes.chip} title={t(`translationsPage.plural.forms.${form}`)}>
			{form.charAt(0).toUpperCase() + form.slice(1)}
		</span>
	)
}

export default PluralFormChip
