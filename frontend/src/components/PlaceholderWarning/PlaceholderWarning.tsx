import { Tooltip } from '@mantine/core'
import { useTranslation } from 'react-i18next'

import { AlertTriangle } from '@/components/Icons'
import textClasses from '@/components/TranslationText/TranslationText.module.css'

import { placeholderWarningMessage } from './placeholderWarningMessage'
import { type PlaceholderWarningProps } from './types'

const TOOLTIP_EVENTS = { hover: true, focus: false, touch: true } as const

/** Warning icon for a value whose placeholders differ from the base language, with what is missing and what is extra; nothing when they match. */
const PlaceholderWarning = ({ missing, extra, tooltip = true }: PlaceholderWarningProps) => {
	const { t } = useTranslation()
	const message = placeholderWarningMessage(t, { missing, extra })
	if (message === null) {
		return null
	}
	const icon = (
		<span className={textClasses.missing} role='img' aria-label={message} data-placeholder-warning>
			<AlertTriangle aria-hidden />
		</span>
	)
	return tooltip ? (
		<Tooltip label={message} events={TOOLTIP_EVENTS} multiline w={260}>
			{icon}
		</Tooltip>
	) : (
		icon
	)
}

export default PlaceholderWarning
