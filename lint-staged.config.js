/** @type {import('lint-staged').Configuration} */
const config = {
	'*': ['secretlint --secretlintignore .secretlintignore'],
	'*.{ts,tsx,js,mjs}': ['eslint --fix', 'prettier --write'],
	'*.{json,md,css,yml,yaml,html}': ['prettier --write'],
}

export default config
