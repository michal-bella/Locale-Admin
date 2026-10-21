import { placeholders } from '@locale/shared'

/** `true` for a placeholder chip the base language does not have (a typo like `{{ perecentage }}`, or a variable the base lost). */
export const isUnknownPlaceholder = (chip: string, basePlaceholders: Set<string> | undefined): boolean =>
	basePlaceholders !== undefined && ![...placeholders(chip)].every((placeholder) => basePlaceholders.has(placeholder))
