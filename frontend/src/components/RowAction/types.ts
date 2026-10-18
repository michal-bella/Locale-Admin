import { type ComponentType, type MouseEvent, type SVGProps } from 'react'

export type RowActionProps = {
	icon: ComponentType<SVGProps<SVGSVGElement>>
	/** Short visible hint, e.g. "Odstrániť". */
	tooltip: string
	/** Accessible name that also names the row, e.g. "Odstrániť administrátora jana@firma.sk". */
	label: string
	/** Red on hover, for destructive actions. */
	danger?: boolean
	disabled?: boolean
	onClick: (event: MouseEvent<HTMLButtonElement>) => void
}
