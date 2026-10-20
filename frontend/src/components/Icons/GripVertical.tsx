import type { SVGProps } from 'react'
const SvgGripVertical = (props: SVGProps<SVGSVGElement>) => (
	<svg xmlns='http://www.w3.org/2000/svg' width={18} height={18} fill='none' viewBox='0 0 24 24' {...props}>
		<circle cx={9} cy={5} r={1.5} fill='currentColor' />
		<circle cx={9} cy={12} r={1.5} fill='currentColor' />
		<circle cx={9} cy={19} r={1.5} fill='currentColor' />
		<circle cx={15} cy={5} r={1.5} fill='currentColor' />
		<circle cx={15} cy={12} r={1.5} fill='currentColor' />
		<circle cx={15} cy={19} r={1.5} fill='currentColor' />
	</svg>
)
export default SvgGripVertical
