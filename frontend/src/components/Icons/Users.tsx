import type { SVGProps } from 'react'
const SvgUsers = (props: SVGProps<SVGSVGElement>) => (
	<svg xmlns='http://www.w3.org/2000/svg' width={18} height={18} fill='none' viewBox='0 0 18 18' {...props}>
		<path
			stroke='currentColor'
			strokeLinecap='round'
			strokeLinejoin='round'
			strokeWidth={1.35}
			d='M9 6a2.25 2.25 0 1 1-4.5 0A2.25 2.25 0 0 1 9 6M2.25 15q0-4.5 4.5-4.5t4.5 4.5M12 4.5A2.25 2.25 0 0 1 12 9m.75 1.5c2.025.3 3 1.65 3 3.75'
		/>
	</svg>
)
export default SvgUsers
