import type { SVGProps } from 'react'
const SvgKey = (props: SVGProps<SVGSVGElement>) => (
	<svg xmlns='http://www.w3.org/2000/svg' width={17} height={17} fill='none' viewBox='0 0 17 17' {...props}>
		<path
			stroke='currentColor'
			strokeLinecap='round'
			strokeLinejoin='round'
			strokeWidth={1.275}
			d='M8.5 10.625a2.833 2.833 0 1 1-5.667 0 2.833 2.833 0 0 1 5.667 0M14.167 2.125l-2.834 2.833L7.792 8.5m3.541-3.542 2.125 2.125'
		/>
	</svg>
)
export default SvgKey
