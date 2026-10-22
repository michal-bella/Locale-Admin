import type { SVGProps } from 'react'
const SvgLock = (props: SVGProps<SVGSVGElement>) => (
	<svg xmlns='http://www.w3.org/2000/svg' width={18} height={18} fill='none' viewBox='0 0 18 18' {...props}>
		<path
			stroke='currentColor'
			strokeLinecap='round'
			strokeLinejoin='round'
			strokeWidth={1.35}
			d='M12.75 8.25V6a3.75 3.75 0 1 0-7.5 0v2.25m.15 7.5h7.2c.84 0 1.26 0 1.581-.164a1.5 1.5 0 0 0 .656-.655c.163-.32.163-.74.163-1.581v-2.7c0-.84 0-1.26-.164-1.581a1.5 1.5 0 0 0-.655-.656c-.32-.163-.74-.163-1.581-.163H5.4c-.84 0-1.26 0-1.581.163a1.5 1.5 0 0 0-.656.656C3 9.389 3 9.809 3 10.65v2.7c0 .84 0 1.26.163 1.581a1.5 1.5 0 0 0 .656.656c.32.163.74.163 1.581.163'
		/>
	</svg>
)
export default SvgLock
