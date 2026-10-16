/** @type {import('prettier').Config} */
const config = {
	useTabs: true,
	tabWidth: 4,
	semi: false,
	singleQuote: true,
	jsxSingleQuote: true,
	trailingComma: 'all',
	printWidth: 160,
	overrides: [{ files: ['*.yml', '*.yaml'], options: { useTabs: false, tabWidth: 2 } }],
}

export default config
