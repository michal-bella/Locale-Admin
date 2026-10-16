import { LANGUAGE } from '@/lib/enum'

export const DEFAULT_LANGUAGE = LANGUAGE.SK

export const LOCALE_STORAGE_KEY = 'locale'

/** FE-only fallback for API errors without a known `ERROR_CODE` (translated as `errors.UNKNOWN`). */
export const UNKNOWN_ERROR_CODE = 'UNKNOWN'
