import type { SVGProps } from 'react'
const SvgDotsHorizontal = (props: SVGProps<SVGSVGElement>) => (
	<svg xmlns='http://www.w3.org/2000/svg' width={18} height={18} fill='none' viewBox='0 0 18 18' {...props}>
		<path
			fill='currentColor'
			d='M3.75 9.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5M9 9.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5M14.25 9.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5'
		/>
	</svg>
)
export default SvgDotsHorizontal
