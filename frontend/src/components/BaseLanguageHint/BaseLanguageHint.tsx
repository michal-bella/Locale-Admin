import { Tooltip } from '@mantine/core'
import { useTranslation } from 'react-i18next'

import { type BaseLanguageHintProps } from './types'

// The badge is not focusable, so touch opens the hint too; the same text is the description of Základný jazyk in the project settings.
const TOOLTIP_EVENTS = { hover: true, focus: false, touch: true } as const

/** Tooltip that explains what the base language of a project is, around every "Základný" badge. */
const BaseLanguageHint = ({ children }: BaseLanguageHintProps) => {
	const { t } = useTranslation()

	return (
		<Tooltip label={t('baseLanguage.hint')} events={TOOLTIP_EVENTS} multiline w={280}>
			{children}
		</Tooltip>
	)
}

export default BaseLanguageHint
