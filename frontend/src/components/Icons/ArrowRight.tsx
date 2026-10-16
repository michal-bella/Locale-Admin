import type { SVGProps } from 'react'
const SvgArrowRight = (props: SVGProps<SVGSVGElement>) => (
	<svg xmlns='http://www.w3.org/2000/svg' width={15} height={15} fill='none' viewBox='0 0 15 15' {...props}>
		<path stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.125} d='m5.625 11.25 3.75-3.75-3.75-3.75M2.5 7.5h6.875' />
	</svg>
)
export default SvgArrowRight
