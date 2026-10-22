import type { SVGProps } from 'react'
const SvgArrowsSort = (props: SVGProps<SVGSVGElement>) => (
	<svg xmlns='http://www.w3.org/2000/svg' width={16} height={16} fill='none' viewBox='0 0 16 16' {...props}>
		<path
			stroke='currentColor'
			strokeLinecap='round'
			strokeLinejoin='round'
			strokeWidth={1.2}
			d='M5 3.333v9.334m0 0-2-2m2 2 2-2M11 12.667V3.333m0 0-2 2m2-2 2 2'
		/>
	</svg>
)
export default SvgArrowsSort
