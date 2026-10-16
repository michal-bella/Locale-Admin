import type { SVGProps } from 'react'
const SvgPlus = (props: SVGProps<SVGSVGElement>) => (
	<svg xmlns='http://www.w3.org/2000/svg' width={16} height={16} fill='none' viewBox='0 0 16 16' {...props}>
		<path stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.2} d='M8 3.333V8m0 0v4.667M8 8H3.333M8 8h4.667' />
	</svg>
)
export default SvgPlus
