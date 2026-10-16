import type { SVGProps } from 'react'
const SvgClose = (props: SVGProps<SVGSVGElement>) => (
	<svg xmlns='http://www.w3.org/2000/svg' width={18} height={18} fill='none' viewBox='0 0 18 18' {...props}>
		<path stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.35} d='M4.5 4.5 9 9m0 0 4.5 4.5M9 9l4.5-4.5M9 9l-4.5 4.5' />
	</svg>
)
export default SvgClose
