import type { SVGProps } from 'react'
const SvgSearch = (props: SVGProps<SVGSVGElement>) => (
	<svg xmlns='http://www.w3.org/2000/svg' width={16} height={16} fill='none' viewBox='0 0 16 16' {...props}>
		<path
			stroke='currentColor'
			strokeLinecap='round'
			strokeLinejoin='round'
			strokeWidth={1.2}
			d='M12 7.333a4.667 4.667 0 1 1-9.333 0 4.667 4.667 0 0 1 9.333 0M13.333 13.333l-2.666-2.666'
		/>
	</svg>
)
export default SvgSearch
