import { type LinkProps } from '@tanstack/react-router'
import { type ComponentType, type MouseEvent, type SVGProps } from 'react'

type RowActionBaseProps = {
	icon: ComponentType<SVGProps<SVGSVGElement>>
	/** Short visible hint, e.g. "Odstrániť". */
	tooltip: string
	/** Accessible name that also names the row, e.g. "Odstrániť administrátora jana@firma.sk". */
	label: string
	/** Red on hover, for destructive actions. */
	danger?: boolean
}

type RowActionButtonProps = RowActionBaseProps & {
	disabled?: boolean
	onClick: (event: MouseEvent<HTMLButtonElement>) => void
	to?: never
	params?: never
	search?: never
}

/** Navigation renders a link, so it can be opened in a new tab and is announced as a link. */
type RowActionLinkProps = RowActionBaseProps & {
	to: LinkProps['to']
	params?: LinkProps['params']
	search?: LinkProps['search']
	disabled?: never
	onClick?: never
}

export type RowActionProps = RowActionButtonProps | RowActionLinkProps
