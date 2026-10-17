import type { SVGProps } from 'react'
const SvgShield = (props: SVGProps<SVGSVGElement>) => (
	<svg xmlns='http://www.w3.org/2000/svg' width={17} height={17} fill='none' viewBox='0 0 17 17' {...props}>
		<path
			stroke='currentColor'
			strokeLinecap='round'
			strokeLinejoin='round'
			strokeWidth={1.275}
			d='M8.5 2.125 2.833 4.25V8.5c0 3.542 2.409 5.667 5.667 6.375 3.258-.708 5.667-2.833 5.667-6.375V4.25z'
		/>
		<path stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.275} d='m6.375 8.5 1.417 1.417 2.833-2.834' />
	</svg>
)
export default SvgShield
