import { useId } from 'react'

import type { SVGProps } from 'react'
const SvgHu = (props: SVGProps<SVGSVGElement>) => {
	const maskId = useId()
	return (
		<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512' {...props}>
			<mask id={maskId}>
				<circle cx={256} cy={256} r={256} fill='#fff' />
			</mask>
			<g mask={`url(#${maskId})`}>
				<path fill='#eee' d='m0 167 253.8-19.3L512 167v178l-254.9 32.3L0 345z' />
				<path fill='#d80027' d='M0 0h512v167H0z' />
				<path fill='#6da544' d='M0 345h512v167H0z' />
			</g>
		</svg>
	)
}
export default SvgHu
