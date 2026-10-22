import { Tooltip } from '@mantine/core'
import { useTranslation } from 'react-i18next'

import { AlertTriangle } from '@/components/Icons'
import textClasses from '@/components/TranslationText/TranslationText.module.css'

import { type PlaceholderWarningProps } from './types'

const TOOLTIP_EVENTS = { hover: true, focus: false, touch: true } as const

/** Warning icon for a value whose placeholders differ from the base language, with what is missing and what is extra; nothing when they match. */
const PlaceholderWarning = ({ missing, extra }: PlaceholderWarningProps) => {
	const { t } = useTranslation()
	if (missing.length === 0 && extra.length === 0) {
		return null
	}
	const message = [
		missing.length > 0 && t('translationsPage.editor.missing', { list: missing.join(', ') }),
		extra.length > 0 && `${t('translationsPage.editor.extra', { list: extra.join(', ') })} ${t('translationsPage.editor.unknownVariable')}`,
	]
		.filter(Boolean)
		.join(' ')
	return (
		<Tooltip label={message} events={TOOLTIP_EVENTS} multiline w={260}>
			<span className={textClasses.missing} role='img' aria-label={message} data-placeholder-warning>
				<AlertTriangle aria-hidden />
			</span>
		</Tooltip>
	)
}

export default PlaceholderWarning
