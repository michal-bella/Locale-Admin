import { type Ref } from 'react'

export type TopBarProps = {
	/** Id of the sidebar the burger controls below `md`. */
	navbarId: string
	navOpened: boolean
	onToggleNav: () => void
	/** Gets focus back when the sidebar closes below `md`. */
	burgerRef?: Ref<HTMLButtonElement>
}
