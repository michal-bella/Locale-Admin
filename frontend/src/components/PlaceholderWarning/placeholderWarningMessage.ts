import { type TFunction } from 'i18next'

import { type PlaceholderWarningProps } from './types'

/** „Chýbajú: {{amount}}. Navyše: {{user}}. …“ for a placeholder mismatch, `null` when the placeholders match. */
export const placeholderWarningMessage = (t: TFunction, { missing, extra }: Pick<PlaceholderWarningProps, 'missing' | 'extra'>): string | null => {
	if (missing.length === 0 && extra.length === 0) {
		return null
	}
	return [
		missing.length > 0 && t('translationsPage.editor.missing', { list: missing.join(', ') }),
		extra.length > 0 && `${t('translationsPage.editor.extra', { list: extra.join(', ') })} ${t('translationsPage.editor.unknownVariable')}`,
	]
		.filter(Boolean)
		.join(' ')
}
