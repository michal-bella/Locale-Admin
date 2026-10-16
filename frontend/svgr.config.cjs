// SVGO turns the Figma stroke="white" into #fff before replaceAttrValues runs. The viewBox is kept so width/height props scale the icon;
// the Figma size stays as the default.
module.exports = {
	replaceAttrValues: { '#fff': 'currentColor' },
	expandProps: 'end',
	dimensions: true,
	typescript: true,
	jsxRuntime: 'automatic',
	svgoConfig: {
		plugins: [{ name: 'preset-default', params: { overrides: { removeViewBox: false } } }],
	},
}
