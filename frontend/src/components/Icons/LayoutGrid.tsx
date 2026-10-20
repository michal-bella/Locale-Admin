import type { SVGProps } from 'react'
const SvgLayoutGrid = (props: SVGProps<SVGSVGElement>) => (
	<svg xmlns='http://www.w3.org/2000/svg' width={18} height={18} fill='none' viewBox='0 0 18 18' {...props}>
		<path
			stroke='currentColor'
			strokeLinecap='round'
			strokeLinejoin='round'
			strokeWidth={1.35}
			d='M3 2.25h3.75A.75.75 0 0 1 7.5 3v3.75a.75.75 0 0 1-.75.75H3a.75.75 0 0 1-.75-.75V3A.75.75 0 0 1 3 2.25M11.25 2.25H15a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-.75.75h-3.75a.75.75 0 0 1-.75-.75V3a.75.75 0 0 1 .75-.75M3 10.5h3.75a.75.75 0 0 1 .75.75V15a.75.75 0 0 1-.75.75H3a.75.75 0 0 1-.75-.75v-3.75A.75.75 0 0 1 3 10.5M11.25 10.5H15a.75.75 0 0 1 .75.75V15a.75.75 0 0 1-.75.75h-3.75a.75.75 0 0 1-.75-.75v-3.75a.75.75 0 0 1 .75-.75'
		/>
	</svg>
)
export default SvgLayoutGrid
