import type { SVGProps } from 'react'
const SvgLogo = (props: SVGProps<SVGSVGElement>) => (
	<svg xmlns='http://www.w3.org/2000/svg' width={19} height={19} fill='none' viewBox='0 0 19 19' {...props}>
		<path
			stroke='currentColor'
			strokeLinecap='round'
			strokeLinejoin='round'
			strokeWidth={1.425}
			d='M3.167 3.958h3.562m0 0h3.563m-3.563 0V2.375m0 1.583c0 3.167-1.583 5.542-3.958 7.125'
		/>
		<path
			stroke='currentColor'
			strokeLinecap='round'
			strokeLinejoin='round'
			strokeWidth={1.425}
			d='M3.958 7.125C5.542 9.5 7.125 10.292 9.5 11.083m1.583 5.542 1.267-3.167m0 0 1.9-4.75 1.9 4.75m-3.8 0h-.08m.08 0h3.8m0 0 1.267 3.167m-1.267-3.167h.08'
		/>
	</svg>
)
export default SvgLogo
