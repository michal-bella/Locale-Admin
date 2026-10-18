import type { SVGProps } from 'react'
const SvgTranslate = (props: SVGProps<SVGSVGElement>) => (
	<svg xmlns='http://www.w3.org/2000/svg' width={18} height={18} fill='none' viewBox='0 0 18 18' {...props}>
		<path
			stroke='currentColor'
			strokeLinecap='round'
			strokeLinejoin='round'
			strokeWidth={1.35}
			d='M3 3.75h3.375m0 0H9.75m-3.375 0v-1.5m0 1.5c0 3-1.5 5.25-3.75 6.75'
		/>
		<path
			stroke='currentColor'
			strokeLinecap='round'
			strokeLinejoin='round'
			strokeWidth={1.35}
			d='M3.75 6.75c1.5 2.25 3 3 5.25 3.75m1.5 5.25 1.2-3m0 0 1.8-4.5 1.8 4.5m-3.6 0h-.075m.075 0h3.6m0 0 1.2 3m-1.2-3h.075'
		/>
	</svg>
)
export default SvgTranslate
