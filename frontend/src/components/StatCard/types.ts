import { type LinkProps } from '@tanstack/react-router'
import { type ComponentType, type ReactNode, type SVGProps } from 'react'

export type StatCardProps = {
	label: string
	/** Shown after the label, e.g. the flag and name of the language the counts are for. */
	labelSuffix?: ReactNode
	/** `undefined` while loading shows a skeleton. */
	value?: number | string
	/** Formats a numeric `value` while it counts up, e.g. as a share of all keys. */
	format?: (value: number) => string
	/** Small line under the value, e.g. "+12 za 30 dní". */
	hint?: string
	/** Short note next to the value, e.g. "93 % kľúčov"; it keeps the card as tall as one without it. */
	share?: string
	icon: ComponentType<SVGProps<SVGSVGElement>>
	tone: 'brand' | 'success' | 'danger'
	/** Share of all keys in percent; the card without it has no progress bar. */
	percent?: number
	/** Sets the table's status filter to this card's keys; `active` while that filter is on. */
	filter?: { label: string; active: boolean; onClick: () => void }
	/** Opens another page with these keys, e.g. Preklady filtered to the untranslated ones. */
	link?: { label: string; to: LinkProps['to']; params?: LinkProps['params']; search?: LinkProps['search'] }
}
