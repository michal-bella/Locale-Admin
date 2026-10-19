import { LANGUAGE } from '@/lib/enum'

export const DEFAULT_LANGUAGE = LANGUAGE.SK

export const LOCALE_STORAGE_KEY = 'locale'

/** Mantine's default key; the pre-paint script in `index.html` reads the same key. */
export const COLOR_SCHEME_STORAGE_KEY = 'mantine-color-scheme-value'

export const DEFAULT_COLOR_SCHEME = 'light'

/** FE-only fallback for API errors without a known `ERROR_CODE` (translated as `errors.UNKNOWN`). */
export const UNKNOWN_ERROR_CODE = 'UNKNOWN'

/** Limit of the whole JSON body of the import routes (`express.json({ limit: '12mb' })` on the backend); checked before sending. */
export const IMPORT_REQUEST_MAX_BYTES = 12 * 1024 * 1024
