// Circle flags (HatScripts/circle-flags, MIT, see src/assets/flags/LICENSE.md). Every source SVG clips itself with <mask id="a">,
// so the id is replaced by useId(): two flags on one page (or two instances of one flag) must not share a mask.
module.exports = {
	// Without this, @svgr/core looks up svgr.config.cjs (the icon config) again for every file and it wins over this one.
	runtimeConfig: false,
	expandProps: 'end',
	dimensions: false,
	typescript: true,
	jsxRuntime: 'automatic',
	replaceAttrValues: { a: '{maskId}', 'url(#a)': '{`url(#${maskId})`}' },
	svgoConfig: {
		plugins: [{ name: 'preset-default', params: { overrides: { removeViewBox: false, cleanupIds: false } } }],
	},
	template: (variables, { tpl }) => tpl`
${variables.imports};
import { useId } from 'react';
${variables.interfaces};
const ${variables.componentName} = (${variables.props}) => {
	const maskId = useId();
	return ${variables.jsx};
};
${variables.exports};
`,
}
