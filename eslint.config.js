import js from '@eslint/js'
import tanstackQuery from '@tanstack/eslint-plugin-query'
import { defineConfig, globalIgnores } from 'eslint/config'
import prettierConfig from 'eslint-config-prettier/flat'
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript'
import { importX } from 'eslint-plugin-import-x'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
	globalIgnores([
		'**/node_modules/',
		'**/dist/',
		'**/build/',
		'**/coverage/',
		'backend/src/generated/',
		'e2e/test-results/',
		'e2e/playwright-report/',
		'.claude/worktrees/',
	]),

	// Base for every TypeScript and JavaScript file in the repo.
	{
		files: ['**/*.{ts,tsx,js,mjs}'],
		extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked, importX.flatConfigs.recommended, importX.flatConfigs.typescript],
		languageOptions: {
			parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
		},
		settings: {
			// Resolves workspace path aliases such as `@/*` from each package's tsconfig.
			'import-x/resolver-next': [
				createTypeScriptImportResolver({ project: ['tsconfig.json', '*/tsconfig.json', 'packages/*/tsconfig.json'], noWarnOnMultipleProjects: true }),
			],
		},
		rules: {
			'@typescript-eslint/consistent-type-definitions': ['error', 'type'],
			'@typescript-eslint/no-deprecated': 'error',
			'@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
			'@typescript-eslint/naming-convention': ['error', { selector: 'enum', format: ['UPPER_CASE'] }, { selector: 'enumMember', format: ['UPPER_CASE'] }],
			'import-x/order': [
				'error',
				{
					groups: ['builtin', 'external', ['internal', 'parent'], ['sibling', 'index'], 'object', 'type'],
					pathGroups: [
						{ pattern: '@/**', group: 'internal', position: 'after' },
						{ pattern: '@locale/**', group: 'internal', position: 'before' },
					],
					pathGroupsExcludedImportTypes: ['builtin'],
					'newlines-between': 'always',
					alphabetize: { order: 'asc', caseInsensitive: false },
				},
			],
			'import-x/no-named-as-default': 'off',
			'import-x/no-named-as-default-member': 'off',
			'no-restricted-imports': [
				'error',
				{ paths: [{ name: 'lodash', message: 'lodash is not allowed in this repo.' }], patterns: ['lodash/*', 'lodash-es'] },
			],
		},
	},
	{
		files: ['**/*.js', '**/*.mjs'],
		extends: [tseslint.configs.disableTypeChecked],
	},

	// Node packages.
	{
		files: ['backend/**/*.ts', 'e2e/**/*.ts', 'scripts/**/*.{ts,js}', '*.{js,ts}'],
		languageOptions: { globals: globals.node },
	},

	// Onboarding guide tools run in Node and drive a browser page (Playwright), so they use both sets of globals.
	{
		files: ['docs/onboarding/**/_tools/*.{js,mjs}'],
		languageOptions: { globals: { ...globals.node, ...globals.browser } },
	},

	// k6 load tests run inside k6, which provides the `k6/*` modules and `__ENV`.
	{
		files: ['scripts/**/*.k6.js'],
		languageOptions: { globals: { __ENV: 'readonly' } },
		rules: { 'import-x/no-unresolved': ['error', { ignore: ['^k6(/|$)'] }] },
	},

	// Frontend.
	{
		files: ['frontend/**/*.{ts,tsx}'],
		extends: [reactHooks.configs.flat['recommended-latest'], reactRefresh.configs.vite, tanstackQuery.configs['flat/recommended']],
		languageOptions: { globals: globals.browser },
	},
	{
		files: ['frontend/**/*.tsx'],
		extends: [jsxA11y.flatConfigs.recommended],
	},

	prettierConfig,
])
