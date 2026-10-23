import { Tooltip } from '@mantine/core'
import { useTranslation } from 'react-i18next'

import { tokenize } from '@/components/TokenEditor/tokens'

import classes from './TranslationText.module.css'
import { isUnknownPlaceholder } from './isUnknownPlaceholder'
import { type TranslationTextProps } from './types'

// The chip is not focusable, so touch opens the hint too.
const TOOLTIP_EVENTS = { hover: true, focus: false, touch: true } as const

/**
 * A translation value with `{{var}}` (also `{{ var }}`) as chips (Figma 3:177), and `#` too for a plural form. HTML tags are neutral chips
 * like in `TokenEditor`, as escaped text, so `<strong>` shows up as typed and never renders. With `basePlaceholders` a chip the base
 * language does not have is a warning chip with a tooltip.
 */
const TranslationText = ({ value, pluralHash = false, basePlaceholders, chipTooltips = true }: TranslationTextProps) => {
	const { t } = useTranslation()
	return (
		<span className={classes.text}>
			{tokenize(value, { hash: pluralHash }).map((token, index) => {
				if (token.type === 'text') {
					return token.value
				}
				if (token.type === 'tag') {
					return (
						<code key={index} className={`${classes.chip} ${classes.chipTag}`}>
							{token.value}
						</code>
					)
				}
				if (token.type === 'placeholder' && isUnknownPlaceholder(token.value, basePlaceholders)) {
					if (!chipTooltips) {
						return (
							<code key={index} className={`${classes.chip} ${classes.chipWarning}`}>
								{token.value}
							</code>
						)
					}
					return (
						<Tooltip key={index} label={t('translationsPage.editor.unknownVariable')} events={TOOLTIP_EVENTS} multiline w={260}>
							<code className={`${classes.chip} ${classes.chipWarning}`}>{token.value}</code>
						</Tooltip>
					)
				}
				return (
					<code key={index} className={classes.chip} title={token.type === 'hash' ? t('translationsPage.plural.hash') : undefined}>
						{token.value}
					</code>
				)
			})}
		</span>
	)
}

export default TranslationText
