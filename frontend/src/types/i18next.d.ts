import type sk from '@/locales/sk.json'

declare module 'i18next' {
	// Module augmentation requires an interface.
	// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
	interface CustomTypeOptions {
		resources: { translation: typeof sk }
	}
}
